/* pv-group-select.mjs — the Primary vote panel's "All voters" group dropdown.

   Modes:
     node .matilda/probe/pv-group-select.mjs --baseline   dump the current
       (all-voters, select-less) panel state to pv-group-select.baseline.json
     node .matilda/probe/pv-group-select.mjs              full verification:
       1. the dropdown exists, says "All voters", sits at the right edge in
          line with the dek's last line on big screens, stacked under the dek
          on phones
       2. the All-voters state is unchanged from the baseline
       3. selections (Men / 18–34 / 55+ / Gen Z / NSW / University / Rural /
          Non-NSW/Vic/Qld) drive figures, bracket, head/dek/meta, y-domain,
          election sub-lines — figures asserted against window.AUSPOL itself.
          Every selection's x axis carries the Election landmark (2026-10-08:
          was "May 2025" for groups with no own election row); a cut group
          whose poll lines open after the election joins its ring marks with
          the 0.5 4 dotted lead-in; a group with no election base delta-rows
          from its first polled month ("since July 2025").
       4. a dot click in a group view opens the poll in All polls on the
          Demographics facet with that view's split picked (2026-10-08); the
          All-voters view's dots keep the Primary facet
       5. a group view's dot is drawn at a LIFTED y (trend plus the wave's
          group-vs-all-voters gap) but its tooltip must tip the figure the
          wave PRINTED, the .rd-note under the chart must disclose the lift,
          and the copy-card caption must not say the bare "Each dot is one
          poll" (2026-10-08); the tooltip's sample line must read
          "n ≈ …" — the group's estimated subsample (2026-10-08)
       6. Space walks the menu while the panel is on screen (the viewport
          claim, 2026-10-08): All voters -> 18–34 -> … -> wrap to All
          voters; off the viewport Space keeps its scroll day job, and a
          FOCUSED menu keeps its own native Space */
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const HERE = fileURLToPath(new URL(".", import.meta.url));
const BASELINE_FILE = join(HERE, "pv-group-select.baseline.json");
const PORT = 8957;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
               ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".xml": "application/xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new" });

const results = [];
const ok = (name, pass, detail) => {
  results.push([name, !!pass]);
  console.log((pass ? "  ✓ " : "  ✗ ") + name + (detail !== undefined ? "  — " + detail : ""));
};
const BASELINE_MODE = process.argv.includes("--baseline");

/* What the panel draws, in a comparable form. Runs after the snapshot tail
   mounts (the primary panel is in the deferred second commit). */
const collect = (VW, VH, selValue) => (async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: VH });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#primary-vote .rd-pv-stat", { timeout: 20000 });
  if (selValue !== null && selValue !== undefined) {
    await page.select("#primary-vote select.rd-pv-sel", selValue);
    await new Promise((r) => setTimeout(r, 500));
  } else {
    await new Promise((r) => setTimeout(r, 300));
  }
  const out = await page.evaluate(() => {
    const sec = document.querySelector("#primary-vote");
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    const rectOf = (el) => { const b = r(el); return b ? { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), right: +b.right.toFixed(1), bottom: +b.bottom.toFixed(1) } : null; };
    const txt = (sel) => { const el = sec.querySelector(sel); return el ? el.textContent.trim() : null; };
    const stats = [...sec.querySelectorAll(".rd-pv-stat")].map((b) => ({
      name: b.querySelector(".rd-pv-name") ? b.querySelector(".rd-pv-name").textContent.trim() : "",
      val: b.querySelector(".rd-pv-val") ? b.querySelector(".rd-pv-val").textContent.trim() : "",
      chg: b.querySelector(".rd-pv-chg") ? b.querySelector(".rd-pv-chg").textContent.trim() : null,
    }));
    const bracket = sec.querySelector(".rd-pv-bracket");
    const groupBox = sec.querySelector(".rd-pv-group");
    const sel = sec.querySelector("select.rd-pv-sel");
    const dek = sec.querySelector(".rd-dek");
    const yTicks = [...sec.querySelectorAll(".rd-pv-chart .axis-label.y, .rd-pv-chart .axis.y text, .rd-pv-chart .axis-label")]
      .map((n) => n.textContent.trim()).filter((t) => /%$/.test(t));
    const xTexts = [...sec.querySelectorAll(".rd-pv-chart svg text")].map((n) => n.textContent.trim()).filter((t) => !/%$/.test(t));
    const dashes = [...sec.querySelectorAll(".rd-pv-chart svg [stroke-dasharray]")].map((n) => n.getAttribute("stroke-dasharray"));
    return {
      hed: txt(".rd-hed"), dek: txt(".rd-dek"), meta: txt(".rd-meta"), xTexts, dashes,
      stats,
      bracket: bracket ? bracket.textContent.trim() + " |span " + bracket.style.gridColumn : null,
      groupBox: groupBox ? (groupBox.querySelector(".rd-pv-grouph") || {}).textContent : null,
      yTicks,
      bodyOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      geom: {
        dek: rectOf(dek),
        selRect: rectOf(sel),
        statsRect: rectOf(sec.querySelector(".rd-pv-stats") || sec.querySelector(".rd-pv-list")),
        secRect: rectOf(sec),
      },
      sel: sel ? {
        text: sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : "",
        value: sel.value,
        optCount: sel.querySelectorAll("option").length,
        groupCount: sel.querySelectorAll("optgroup").length,
        groupLabels: [...sel.querySelectorAll("optgroup")].map((o) => o.label),
        options: [...sel.querySelectorAll("option")].map((o) => o.textContent),
      } : null,
    };
  });
  await page.close();
  return out;
})();

/* The expected level-grouping k and sorted parts, computed from AUSPOL's
   payload the same way the panel does (desc by v; combine margins). */
const expectedFor = (groupLabel) => (async () => {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#primary-vote", { timeout: 20000 });
  const out = await page.evaluate((label) => {
    const D = window.AUSPOL;
    const mk = (V, C) => ["alp", "lnp", "grn", "onp", "oth"].map((id) => ({ id, v: V[id], ci: C[id] || 0 }))
      .sort((a, b) => b.v - a.v);
    const levelK = (parts) => {
      let k = 1, top = parts[0];
      while (k < parts.length && top.v - parts[k].v < Math.sqrt(top.ci * top.ci + parts[k].ci * parts[k].ci)) k++;
      return k;
    };
    const T = D.demographics;
    const lm = D.aggPrimary[D.aggPrimary.length - 1];
    const all = { parts: mk(D.latest.primary, lm.ci || {}) };
    all.k = levelK(all.parts);
    const res = { allVoters: all, T: !!T };
    if (label && T) {
      if (!D.__gcache) D.__gcache = {};
      let g = null; outer: for (const t of T.tabs) for (const s of t.sets) { const f = s.groups.find((x) => x.label === label); if (f) { g = f; break outer; } }
      if (g) {
        const parts = mk(g.v, g.ci);
        const elec = !!((D.demoStateElection && D.demoStateElection.groups && D.demoStateElection.groups[label]) ||
          (D.demoLocElection && D.demoLocElection.groups && D.demoLocElection.groups[label]));
        res.group = { parts, k: levelK(parts), houses: g.houses, window: T.window,
          elec, monthly0: g.monthly && g.monthly.length > 1 ? g.monthly[0][0] : null };
      }
    }
    return res;
  }, groupLabel);
  await page.close();
  return out;
})();

if (BASELINE_MODE) {
  const dump = { "1280": await collect(1280, 900, null), "390": await collect(390, 844, null) };
  await writeFile(BASELINE_FILE, JSON.stringify(dump, null, 1));
  console.log("baseline written to " + BASELINE_FILE);
  for (const W of ["1280", "390"]) {
    console.log(`--- @${W} hed:`, dump[W].hed);
    console.log(`    dek:`, dump[W].dek);
    console.log(`    meta:`, dump[W].meta);
    console.log(`    stats:`, JSON.stringify(dump[W].stats));
    console.log(`    bracket:`, dump[W].bracket, "| groupBox:", dump[W].groupBox);
    console.log(`    yTicks:`, JSON.stringify(dump[W].yTicks));
    console.log(`    select present:`, !!dump[W].sel);
  }
  await browser.close(); server.close();
  process.exit(0);
}

/* ---- full verification ------------------------------------------------- */
let baseline = null;
try { baseline = JSON.parse(await readFile(BASELINE_FILE, "utf8")); } catch {}

console.log("== dropdown presence, defaults, geometry ==");
for (const [W, H] of [[1280, 900], [768, 1024], [390, 844]]) {
  const s = await collect(W, H, null);
  console.log(`--- @${W}`);
  ok("select exists", !!s.sel);
  if (!s.sel) continue;
  ok(`selected text is "All voters"`, s.sel.text === "All voters", s.sel.text);
  ok("28 options (All voters + 27 groups)", s.sel.optCount === 28, s.sel.optCount);
  ok("8 optgroups", s.sel.groupCount === 8, s.sel.groupLabels.join(" | "));
  const g = s.geom;
  if (W > 640) {
    ok("at the right edge (within 2px of the stat strip's right)", g.selRect && g.statsRect && Math.abs(g.selRect.right - g.statsRect.right) <= 2,
      g.selRect && g.statsRect ? `sel right ${g.selRect.right} vs strip ${g.statsRect.right}` : "missing");
    ok("bottom-aligned with the dek's last line (±3px)", g.selRect && g.dek && Math.abs(g.selRect.bottom - g.dek.bottom) <= 3,
      g.selRect && g.dek ? `sel bottom ${g.selRect.bottom} vs dek bottom ${g.dek.bottom}` : "missing");
    ok("same row as the dek (tops overlap)", g.selRect && g.dek && g.selRect.y < g.dek.bottom && g.selRect.bottom > g.dek.y);
    ok("x axis carries the Election landmark", s.xTexts && s.xTexts.some((t) => t === "Election"), JSON.stringify((s.xTexts || []).slice(0, 8)));
  } else {
    ok("stacked under the dek", g.selRect && g.dek && g.selRect.y >= g.dek.bottom - 1,
      g.selRect && g.dek ? `sel top ${g.selRect.y} vs dek bottom ${g.dek.bottom}` : "missing");
    ok("left-aligned with the dek (±2px)", g.selRect && g.dek && Math.abs(g.selRect.x - g.dek.x) <= 2,
      g.selRect && g.dek ? `sel x ${g.selRect.x} vs dek x ${g.dek.x}` : "missing");
  }
  ok("no horizontal overflow", s.bodyOverflow);
}

console.log("== all-voters state unchanged vs baseline ==");
if (!baseline) {
  console.log("  (no baseline file — skipped; run with --baseline first)");
} else {
  for (const W of ["1280", "390"]) {
    const now = await collect(+W, W === "390" ? 844 : 900, null);
    const was = baseline[W];
    ok(`@${W} hed identical`, now.hed === was.hed, now.hed);
    ok(`@${W} dek identical`, now.dek === was.dek);
    ok(`@${W} meta identical`, now.meta === was.meta, now.meta);
    ok(`@${W} stat figures identical`, JSON.stringify(now.stats.map((x) => x.val)) === JSON.stringify(was.stats.map((x) => x.val)),
      JSON.stringify(now.stats.map((x) => x.val)));
    ok(`@${W} stat chg lines identical`, JSON.stringify(now.stats.map((x) => x.chg)) === JSON.stringify(was.stats.map((x) => x.chg)));
    ok(`@${W} bracket/group identical`, now.bracket === was.bracket && now.groupBox === was.groupBox, `${now.bracket} / ${now.groupBox}`);
    ok(`@${W} y ticks identical`, JSON.stringify(now.yTicks) === JSON.stringify(was.yTicks), JSON.stringify(now.yTicks));
  }
}

console.log("== selections ==");
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = {
  Men: "men", "18–34": "18–34s", "55+": "over-55s", "Gen Z": "Gen Z", University: "university graduates",
  NSW: "NSW voters", Rural: "rural voters", "Non-NSW/Vic/Qld": "voters in the non-eastern-mainland states",
};
for (const [label, ev] of [["Men", { level: true, chg: false }], ["18–34", {}], ["55+", { lead: "One Nation" }], ["Gen Z", {}],
                           ["NSW", { chg: true }], ["University", {}], ["Rural", { tallTicks: true, chg: true }], ["Non-NSW/Vic/Qld", { chg: true }]]) {
  const exp = await expectedFor(label);
  const s = await collect(1280, 900, label);
  console.log(`--- ${label}`);
  ok(`${label} applies`, s.sel && s.sel.value === label, s.sel && s.sel.value);
  ok("head names the group", s.hed && s.hed.includes(SHORT[label]), s.hed);
  const g = exp.group;
  if (g) {
    const wantVals = g.parts.slice().sort((a, b) => b.v - a.v).map((p) => p.v.toFixed(1) + "%");
    const gotVals = s.stats.map((x) => x.val.replace(/\s+/g, ""));
    ok("figures match the payload (party order)", JSON.stringify(gotVals) === JSON.stringify(wantVals), JSON.stringify(gotVals));
    const top = g.parts[0], second = g.parts[1];
    const wantGap = (top.v - second.v).toFixed(1);
    ok("dek quotes the gap", s.dek && (wantGap === "0.0" ? s.dek.includes("dead level") : s.dek.includes(wantGap + " points")),
      s.dek && s.dek.split(". ").slice(0, 2).join(". "));
    ok("dek contrasts all voters", s.dek && s.dek.includes("Among all voters"), s.dek);
    ok("meta carries the pooled houses", s.meta && s.meta.includes("Pooled from the last " + g.window) && g.houses.every((h) => s.meta.includes(h.replace("RedBridge/Accent", "RedBridge"))), s.meta);
    const expectBracket = g.k >= 2;
    const hasBracket = !!s.bracket || !!s.groupBox;
    ok(`margin-of-uncertainty cells ${expectBracket ? "shaded (k=" + g.k + ")" : "absent (k=1)"}`, hasBracket === expectBracket,
      `${String(s.bracket)} / ${String(s.groupBox)}`);
    const wantChg = !!ev.chg;
    const gotChg = s.stats.some((x) => x.chg && /since the election/.test(x.chg));
    ok(`election sub-lines ${wantChg ? "present" : "absent"}`, gotChg === wantChg,
      JSON.stringify(s.stats.map((x) => x.chg && x.chg.split(" ").slice(-3).join(" "))));
    ok("x axis carries the Election landmark", s.xTexts && s.xTexts.some((t) => t === "Election"),
      JSON.stringify((s.xTexts || []).slice(0, 8)));
    if (g.elec && g.monthly0 && g.monthly0 > "2025-05") {
      ok("dotted ring-to-line lead-in present", s.dashes && s.dashes.some((d) => d === "0.5 4"), JSON.stringify(s.dashes));
    }
    if (!g.elec && g.monthly0) {
      const want = "since " + MONTH_NAMES[+g.monthly0.slice(5, 7) - 1] + " " + g.monthly0.slice(0, 4);
      ok(`deltas from first polled month (${want})`, s.stats.some((x) => x.chg && x.chg.includes(want)),
        JSON.stringify(s.stats.map((x) => x.chg)) + " — want a line containing “" + want + "”");
    }
    if (ev.lead) ok(`head says lead for ${ev.lead}`, s.hed && s.hed.includes(ev.lead + " leads"), s.hed);
    if (ev.level) ok("head says level", s.hed && /are level/.test(s.hed), s.hed);
    if (ev.tallTicks) ok("y axis stretches past 40 for this group", s.yTicks.some((t) => t === "50%"), JSON.stringify(s.yTicks));
  }
  ok("no horizontal overflow", s.bodyOverflow);
}

/* phone form: the tinted group box must follow the selection too */
{
  const s = await collect(390, 844, "Men");
  console.log("--- Men @390");
  ok("phone group box present for level pair", !!s.groupBox, String(s.groupBox));
  ok("phone figures match", s.stats.length === 5 && s.stats[0].val.replace(/\s+/g, "").endsWith("%"), JSON.stringify(s.stats.map((x) => x.val)));
  const sAll = await collect(390, 844, null);
  ok("back to All voters", sAll.hed === (baseline ? baseline["390"].hed : sAll.hed), sAll.hed);
}

/* ---- a dot click opens the clicked poll in All polls on the matching
        facet: a group view (anything but All voters) lands on Demographics
        with that view's split already picked (Gen Z → Age, Renting → Home,
        NSW → Place); the All-voters chart keeps the Primary facet. The
        tail hollow ring (fill var(--chart-bg)) is a border mark with no
        poll behind it, like the issues panel's, so solid dots only. ---- */
const clickDot = async (selValue) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#primary-vote .rd-pv-chart svg", { timeout: 20000 });
  if (selValue) {
    await page.select("#primary-vote select.rd-pv-sel", selValue);
    await new Promise((r) => setTimeout(r, 600));
  } else {
    await new Promise((r) => setTimeout(r, 300));
  }
  const dot = await page.evaluate(() => {
    const svg = document.querySelector("#primary-vote .rd-pv-chart svg");
    svg.scrollIntoView({ block: "center" });
    const cs = [...svg.querySelectorAll("circle.scatter-dot")].filter((c) => c.getAttribute("fill") !== "var(--chart-bg)");
    if (!cs.length) return null;
    const r = cs[cs.length - 1].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, n: cs.length };
  });
  let landed = null;
  if (dot) {
    await page.mouse.move(dot.x - 30, dot.y - 30);
    await new Promise((r) => setTimeout(r, 150));
    await page.mouse.move(dot.x, dot.y);
    await new Promise((r) => setTimeout(r, 300));
    await page.mouse.click(dot.x, dot.y);
    try {
      await page.waitForFunction(() => location.hash === "#allpolls" && document.querySelector(".rd-ap-tabs button"), { timeout: 10000 });
      landed = await page.evaluate(() => ({
        active: (([...document.querySelectorAll(".rd-ap-tabs button")].find((b) => b.getAttribute("aria-pressed") === "true")) || {}).textContent || null,
        split: (([...document.querySelectorAll('.rd-ap-dpick [role="radio"]')].find((b) => b.getAttribute("aria-checked") === "true")) || {}).textContent || null,
        open: !!document.querySelector(".rd-ap-open"),
      }));
    } catch {}
  }
  await page.close();
  return { dot, landed };
};
console.log("== dot clicks open All polls on the matching facet ==");
for (const { view, wantFacet, wantSplit } of [{ view: "Gen Z", wantFacet: "Demographics", wantSplit: "Age" },
                                              { view: "Renting", wantFacet: "Demographics", wantSplit: "Home" },
                                              { view: null, wantFacet: "Primary", wantSplit: null }]) {
  const name = view || "All voters";
  const { dot, landed } = await clickDot(view);
  console.log(`--- ${name} dot click`);
  ok(`${name}: chart renders solid poll dots`, !!dot && dot.n > 2, dot && `${dot.n} solid dots`);
  ok(`${name}: click lands in All polls on the ${wantFacet} facet`, !!landed && landed.active === wantFacet, landed && `facet: ${landed.active}`);
  ok(`${name}: the clicked poll opens`, !!landed && landed.open === true, landed && `open=${landed.open}`);
  if (wantSplit) ok(`${name}: split radio matches the view (${wantSplit})`, !!landed && landed.split === wantSplit, landed && `split: ${landed.split}`);
}

/* ---- a group dot is drawn at a lifted y (trend plus the wave's group-vs-
        all-voters gap) but TIPS the figure the wave printed - recomputed
        here from window.AUSPOL, never the site copy. The .rd-note under
        the chart and the copy-card caption carry the lift disclosure in
        the reader's own view; the all-voters view keeps its classic
        caption and no note. ---- */
const hoverTip = async (selValue, groupLabel) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#primary-vote .rd-pv-chart svg", { timeout: 20000 });
  if (selValue) {
    await page.select("#primary-vote select.rd-pv-sel", selValue);
    await new Promise((r) => setTimeout(r, 600));
  } else {
    await new Promise((r) => setTimeout(r, 300));
  }
  const dot = await page.evaluate(() => {
    const svg = document.querySelector("#primary-vote .rd-pv-chart svg");
    svg.scrollIntoView({ block: "center" });
    const cs = [...svg.querySelectorAll("circle.scatter-dot")].filter((c) => c.getAttribute("fill") !== "var(--chart-bg)");
    if (!cs.length) return null;
    const r = cs[cs.length - 1].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  let got = null;
  if (dot) {
    await page.mouse.move(dot.x - 30, dot.y - 30);
    await new Promise((r) => setTimeout(r, 150));
    await page.mouse.move(dot.x, dot.y);
    try {
      await page.waitForSelector("#primary-vote .rd-pv-chart .tip .tip-val", { timeout: 4000 });
      got = await page.evaluate((gLabel) => {
        const sec = document.querySelector("#primary-vote");
        const t = sec.querySelector(".rd-pv-chart .tip");
        const rows = [...t.querySelectorAll(".tip-row")].map((r) => ({
          label: ((r.querySelector(".tip-label") || {}).textContent || "").trim(),
          value: ((r.querySelector(".tip-val") || {}).textContent || "").trim(),
        }));
        const title = ((t.querySelector(".tip-title") || {}).textContent || "").trim();
        const field = (rows.find((r) => r.label === "Field") || {}).value || "";
        const partyRow = rows.find((r) => r.label !== "Field") || null;
        /* the figure the wave printed, recomputed from the payload */
        const D = window.AUSPOL;
        const KEYS = ["alp", "lnp", "grn", "onp", "oth"];
        const pi = partyRow ? KEYS.findIndex((k) => (k === "oth" ? "Others & independents" : D.PARTIES[k].name) === partyRow.label) : -1;
        const q = D.individualPolls.find((x) => x.pollster === title && x.dateLabel === field);
        let printed = null, expectSub = null;
        if (q && pi >= 0) {
          if (gLabel) {
            const gi = D.demoGroups.indexOf(gLabel);
            if (q.grp && q.grp.v && q.grp.v[gi]) printed = q.grp.v[gi][pi].toFixed(1);
            if (q.grp && q.grp.n && q.grp.n[gi] != null) expectSub = "n ≈ " + q.grp.n[gi].toLocaleString();
          } else if (q.p) { printed = q.p[KEYS[pi]].toFixed(1); expectSub = q.sample ? "n = " + q.sample.toLocaleString() : null; }
        }
        const sub = ((t.querySelector(".tip-sub") || {}).textContent || "").trim() || null;
        const note = sec.querySelector(".rd-pv-chart .rd-note");
        let caption = null;
        const cd = sec.querySelector(".rd-pv-chart .chart[data-copy]");
        if (cd) { try { caption = JSON.parse(cd.getAttribute("data-copy")).caption; } catch {} }
        return { title, partyRow, field, printed, expectSub, sub, noteText: note ? note.textContent : null, caption };
      }, groupLabel);
    } catch {}
  }
  await page.close();
  return { dot, got };
};
console.log("== group dots tip the printed figure, and the lift is disclosed ==");
for (const { view, group } of [{ view: "Gen Z", group: "Gen Z" }, { view: "Renting", group: "Renting" }, { view: null, group: null }]) {
  const name = view || "All voters";
  const { dot, got } = await hoverTip(view, group);
  console.log(`--- ${name} dot tooltip`);
  ok(`${name}: tooltip renders for a solid dot`, !!dot && !!got && !!got.partyRow, got && got.partyRow ? got.partyRow.label : "");
  if (got && got.partyRow) {
    ok(`${name}: tip value is the printed figure`, got.printed != null && got.partyRow.value === got.printed,
      `tip ${got.partyRow.value} vs printed ${got.printed} (${got.title}, ${got.field})`);
    ok(`${name}: sample line is ${group ? "the group's estimated subsample" : "the poll's own n"}`,
      got.expectSub != null && got.sub === got.expectSub,
      `tip "${got.sub}" vs expected "${got.expectSub}" (${got.title}, ${got.field})`);
  }
  if (group) {
    ok(`${name}: lift note under the chart`, !!got && !!got.noteText && got.noteText.includes("own all-voters figure") && got.noteText.includes("Demographics"),
      got && String(got.noteText).slice(0, 80));
    ok(`${name}: copy caption discloses the lift`, !!got && !!got.caption && got.caption.includes("less its own all-voters figure"), got && got.caption);
  } else {
    ok(`${name}: no lift note in the all-voters view`, !!got && got.noteText === null, got && String(got.noteText).slice(0, 60));
    ok(`${name}: copy caption is the all-voters one`, !!got && got.caption === "Each dot is one poll; lines are monthly averages, shaded bands their 95% intervals.",
      got && got.caption);
  }
}

/* ---- Space walks the group menu while the panel is on screen (viewport
        claim): All voters -> each option in DOM order -> wrap to All
        voters. The neighbouring sections claim Space too — the hero
        (#two-party) while it is even 1px in view and the Latest card
        (#latest-polls) on its two-party facet — so the positive checks
        park the page in the window where #primary-vote is the ONLY
        claiming section on screen. Off both, Space keeps its scroll day
        job (pressed past the Latest card, where no section claims);
        a FOCUSED select keeps its own native Space. ---- */
console.log("== Space walks the group menu ==");
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#primary-vote select.rd-pv-sel", { timeout: 20000 });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const curVal = () => page.evaluate(() => document.querySelector("#primary-vote select.rd-pv-sel").value);
  const order = await page.evaluate(() =>
    [...document.querySelectorAll("#primary-vote select.rd-pv-sel option")].map((o) => o.value));
  ok("menu order pins All voters to first group 18–34", order[0] === "" && order[1] === "18–34" && order.length === 28,
     order.slice(0, 4).join("|") + " | n=" + order.length);

  /* park where #primary-vote alone holds the key: below the hero's whole
     section, above the point the Latest card's section starts to show */
  const parked = await page.evaluate(() => {
    const hero = document.getElementById("two-party");
    const prim = document.getElementById("primary-vote");
    const latest = document.getElementById("latest-polls");
    const lo = hero.offsetTop + hero.offsetHeight + 20;
    const hi = latest.offsetTop - window.innerHeight - 20;
    const y = Math.min(lo, hi);
    window.scrollTo(0, y);
    const r = prim.getBoundingClientRect();
    return { y, primInView: r.bottom > 0 && r.top < window.innerHeight,
             heroInView: hero.getBoundingClientRect().bottom > 0,
             latestInView: latest.getBoundingClientRect().top < window.innerHeight };
  });
  ok("parked with only the primary panel claiming", parked.primInView && !parked.heroInView && !parked.latestInView,
     JSON.stringify(parked));
  await sleep(500);
  ok("claim baseline: starts on All voters", (await curVal()) === "", await curVal());
  const yClaim = await page.evaluate(() => window.scrollY);
  const seen = [await curVal()];
  let firstGap = -1;
  for (let i = 1; i < order.length; i++) {
    await page.keyboard.press("Space");
    await sleep(120);
    seen.push(await curVal());
    if (seen[i] !== order[i] && firstGap < 0) firstGap = i;
  }
  ok("each Space steps to the menu's next option (all 27 groups)", JSON.stringify(seen) === JSON.stringify(order),
     firstGap >= 0 ? `press ${firstGap}: got ${JSON.stringify(seen[firstGap])}, want ${JSON.stringify(order[firstGap])}` : seen.slice(0, 4).join(" -> "));
  await page.keyboard.press("Space");
  await sleep(150);
  ok("wraps round to All voters", (await curVal()) === "", await curVal());
  ok("page never scrolled while the claim held", (await page.evaluate(() => window.scrollY)) === yClaim,
     "scrollY " + (await page.evaluate(() => window.scrollY)) + " vs " + yClaim);

  /* figures follow the walk: one more press lands on the first age group */
  await page.keyboard.press("Space");
  await sleep(400);
  const walked = await page.evaluate(() => {
    const sec = document.querySelector("#primary-vote");
    return { hed: sec.querySelector(".rd-hed") ? sec.querySelector(".rd-hed").textContent.trim() : null,
             val: sec.querySelector("select.rd-pv-sel").value };
  });
  ok("next press after wrap lands on the first age group", walked.val === "18–34", walked.val);
  ok("panel head follows the walk", walked.hed && walked.hed.includes("18–34"), walked.hed && walked.hed.slice(0, 90));

  /* a FOCUSED select keeps its own Space (native menu-opening behaviour;
     the claim stands aside by the BODY/HTML guard) */
  await page.evaluate(() => document.querySelector("#primary-vote select.rd-pv-sel").focus());
  await sleep(100);
  await page.keyboard.press("Space");
  await sleep(200);
  ok("focused select keeps its own Space (no step)", (await curVal()) === "18–34", await curVal());
  await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); });

  /* past the Latest card no section claims: Space scrolls and leaves the
     menu untouched (scrolling past #primary-vote by its own height would
     park INSIDE the Latest card's claim and the key would be eaten) */
  await page.evaluate(() => {
    const latest = document.getElementById("latest-polls");
    window.scrollTo(0, latest.offsetTop + latest.offsetHeight + 200);
  });
  await sleep(400);
  const offState = await page.evaluate(() => {
    const r = document.getElementById("primary-vote").getBoundingClientRect();
    return { primInView: r.bottom > 0 && r.top < window.innerHeight };
  });
  ok("panel fully off-screen for the negative case", !offState.primInView, "");
  const yOff0 = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Space");
  await sleep(400);
  ok("off-claim Space scrolls (day job)", (await page.evaluate(() => window.scrollY)) > yOff0,
     "scrollY " + (await page.evaluate(() => window.scrollY)) + " vs " + yOff0);
  ok("off-claim Space leaves the menu alone", (await curVal()) === "18–34", await curVal());
  await page.close();
}

const fails = results.filter(([, p]) => !p);
console.log(`\n${results.length - fails.length}/${results.length} passed` + (fails.length ? ` — ${fails.length} FAILED` : ""));
await browser.close(); server.close();
process.exit(fails.length ? 1 : 0);
