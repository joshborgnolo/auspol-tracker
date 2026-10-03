#!/usr/bin/env node
// probe-vic-standard — the vic-polish loop's DETERMINISTIC audit pack. Reads
// vic/index.html, data/vic-polls.json and .build/refresh-vic.mjs, and emits a
// JSON inventory + mechanical checks the reviewer agent (and a human) can
// judge against .build/vic-main-standard.md. Chrome-free and read-only by
// design: the reviewer's evidence must never depend on a browser.
//
//   node .build/probe-vic-standard.mjs            → VP_AUDIT {json} on stdout
//   VP_PACK_OUT=<file> node .build/probe-vic-standard.mjs
//                                                 → also writes the full pack
// Checks are PASS/FAIL only where the standard is mechanical; anything that
// needs judgement is inventory for the reviewer. Exit is 0 even with failed
// checks (a pack full of FAILs is still a pack) — UNLESS the inputs
// themselves are unreadable, which is a real error: exit 1 then, no pack.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const read = (p) => readFileSync(path.join(REPO, p), "utf8");

const checks = [];
const ck = (id, area, ok, detail) => checks.push({ id, area, ok: !!ok, detail: String(detail).slice(0, 400) });
const info = (id, area, detail) => ck(id, area, true, detail);

const PAGE_F = "vic/index.html";
const DATA_F = "data/vic-polls.json";
const GEN_F = ".build/refresh-vic.mjs";
for (const f of [PAGE_F, DATA_F, GEN_F]) {
  if (!existsSync(path.join(REPO, f))) { console.error(`probe-vic-standard: ${f} not found`); process.exit(1); }
}
const html = read(PAGE_F);
const data = JSON.parse(read(DATA_F));
const gen = read(GEN_F);

// ---- shell & chrome (the lifted parts must be machinery, not copies) -----------
for (const m of ["shell:head", "shell:header", "shell:footer"]) {
  const marker = "<!--" + m + "-->";
  ck(`shell-marker-${m}`, "visual", html.includes(marker), `${marker} ${html.includes(marker) ? "present" : "MISSING"}`);
}
ck("kicker-vicpoll", "visual", /<p class="sh-kicker">Vicpoll<\/p>/.test(html), "sh-kicker reads “Vicpoll” (URL is /vic/ but the display name stays Vicpoll)");
ck("theme-colors", "visual", /<meta name="theme-color"[^>]*media="\(prefers-color-scheme: light\)"/.test(html) && /\(prefers-color-scheme: dark\)/.test(html), "paired light/dark theme-color metas present");
ck("theme-switch", "visual", /class="sh-theme"/.test(html), "shell colour-theme switch group present");
ck("sh-frame-wrapper", "visual", /class="sh-frame"/.test(html), "content sits inside the shell frame (gutter/max-width shared with the main page)");
ck("skip-link", "visual", /class="sh-skip"/.test(html) || /skip-link/.test(html), "skip link present");
const hexOutsideShell = (() => {
  // crude: hex literals in page-OWNED style blocks (outside shell markers)
  const own = html.replace(/<!--shell:head-->[\s\S]*?<!--shell:header-->/, "").replace(/<!--shell:header-->[\s\S]*?<!--shell:footer-->/, "");
  const m = own.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  return m;
})();
info("page-own-hex-colours", "visual", `${hexOutsideShell.length} literal hex references in page-owned markup/CSS — every visible colour should ride tokens (main page convention), hardcoded hex is a dark-mode hazard: ${[...new Set(hexOutsideShell)].slice(0, 12).join(" ")}`);

// ---- sections ------------------------------------------------------------------
const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
const EXPECTED_H2 = ["Two-party preferred", "First preferences", "The leaders", "Every published poll"];
for (const want of EXPECTED_H2) {
  ck(`section-${want.toLowerCase().replace(/[^a-z]+/g, "-")}`, "feature", h2s.some((h) => h.includes(want)), `h2 “${want}” ${h2s.some((h) => h.includes(want)) ? "present" : "MISSING"} (page carries: ${h2s.join(" · ")})`);
}
const METHOD_H2 = ["How the headline blend is made", "Why two-party is published-only", "Where the numbers come from"];
for (const want of METHOD_H2) {
  ck(`method-${want.toLowerCase().replace(/[^a-z]+/g, "-")}`, "feature", h2s.some((h) => h.includes(want)), `method h2 “${want}” ${h2s.some((h) => h.includes(want)) ? "present" : "MISSING"}`);
}

// ---- method-note content (the vic skill's required clauses) ----------------------
const strip = (s) => s.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const text = strip(html);
ck("method-published-only", "data", /published[- ](?:only|2PP)|only published/i.test(text), "method note states the published-2PP-only policy");
ck("method-constants", "data", /(half[- ]life|halv)/i.test(text) && /\b28\b/.test(text), "method note states the recency constants (weight halving every 28 days)");
ck("method-estimates", "data", /estimate|not an official|published figures/i.test(text), "method note carries the estimates/credit passages");
ck("published-2pp-wording", "data", !/implied 2PP|flows-implied/i.test(text) || /never|not used|deliberately/i.test(text), "no flows-implied 2PP presented (no 2022 ONP baseline — locked decision)");

// ---- typography conventions ------------------------------------------------------
const minusU2212 = text.includes("−");
const hyphenMinusRuns = text.match(/[A-Za-z]\s-\s\d+(?:\.\d+)?\b|\b-+\d+(\.\d+)?\s*%/g) || [];
ck("minus-sign", "visual", minusU2212, `U+2212 minus ${minusU2212 ? "used" : "ABSENT — figure negatives must use it (main-page convention)"}${hyphenMinusRuns.length ? `; plain-hyphen contexts worth a look: ${JSON.stringify([...new Set(hyphenMinusRuns)].slice(0, 5))}` : ""}`);
const capsRuns = (html.match(/<h[1-4][^>]*>[^<]*[A-Z]{4,}[^<]*<\/h[1-4]>/g) || []);
ck("headings-sentence-case", "visual", capsRuns.length === 0, `ALL-CAPS literals in headings: ${capsRuns.length} (main-page convention: sentence case in source, caps only via CSS)`);

// ---- tables & links ----------------------------------------------------------------
const trCount = (html.match(/<tr[ >]/g) || []).length;
const extLinks = [...html.matchAll(/href="(https?:[^"]+)"/g)].map((m) => m[1]);
const sourceLinks = extLinks.filter((h) => !/auspoltracker\.com|auspol-now|fonts\.g/.test(h));
info("table-rows", "feature", `${trCount} <tr> rows in the page`);
ck("table-source-links", "feature", sourceLinks.length > 0, `${sourceLinks.length} outbound links (poll table rows must link their source)`);
const srSample = (text.match(/—/g) || []).length;
info("em-dash-missing-markers", "data", `${srSample} em-dashes in visible text (missing-value convention on the main tables)`);

// ---- data census -----------------------------------------------------------------
const polls = Array.isArray(data.polls) ? data.polls : [];
const tpp3 = Array.isArray(data.threeParty) ? data.threeParty : [];
const ldr = Array.isArray(data.leadership) ? data.leadership : [];
const firms = {};
for (const p of polls) firms[p.firm] = (firms[p.firm] || 0) + 1;
info("census-polls", "data", `${polls.length} primary rows: ${Object.entries(firms).map(([f, n]) => `${f} ${n}`).join(", ")}`);
info("census-3pp", "data", `${tpp3.length} three-cornered-preferred rows`);
info("census-leadership", "data", `${ldr.length} leadership rows`);

const newest = polls.reduce((a, p) => (p.fwEnd > a ? p.fwEnd : a), "1970-01-01");
const oldest = polls.reduce((a, p) => (p.fwEnd < a ? p.fwEnd : a), "2999-01-01");
const daysSinceNewest = Math.round((Date.now() - Date.parse(newest + "T00:00:00Z")) / 864e5);
ck("data-fresh", "data", daysSinceNewest <= 14, `newest fieldwork end ${newest} (${daysSinceNewest}d ago; range ${oldest} → ${newest})`);

const dupes = {};
for (const p of polls) { const k = `${p.firm}|${p.fwEnd}`; dupes[k] = (dupes[k] || 0) + 1; }
const dupList = Object.entries(dupes).filter(([, n]) => n > 1);
ck("no-dup-waves", "data", dupList.length === 0, dupList.length ? `duplicate firm|fwEnd rows: ${dupList.map(([k]) => k).join(", ")}` : "no duplicate firm|fieldwork-end rows");

const tpp2Rows = polls.filter((p) => p.tpp2 && p.tpp2.alp != null).length;
info("tpp2-coverage", "data", `${tpp2Rows}/${polls.length} primary rows carry a published 2PP`);
const sampleRows = polls.filter((p) => typeof p.sample === "number").length;
info("sample-coverage", "data", `${sampleRows}/${polls.length} rows carry a published sample (absent-not-zero: generator weights with SAMPLE_DEFAULT)`);
const srcRows = polls.filter((p) => typeof p.sourceUrl === "string" && /^https?:/.test(p.sourceUrl)).length;
ck("row-source-urls", "data", srcRows / (polls.length || 1) > 0.7, `${srcRows}/${polls.length} rows carry an http(s) sourceUrl`);

// Core majors must always be read; onp/ind/oth are legitimately null on
// older waves (ONP wasn't fielded — the vic skill's data-legitimate-nulls
// rule: never "fix" a row in data to appease a guard).
const primMissing = polls.filter((p) => !p.primary || ["alp", "lnp", "grn"].some((k) => p.primary[k] == null)).length;
ck("primary-cores-present", "data", primMissing === 0, `${primMissing} rows missing ALP/LNP/GRN; onp/ind/oth nulls are legitimate absent data`);
const onpNulls = polls.filter((p) => p.primary && p.primary.onp == null).length;
info("onp-null-waves", "data", `${onpNulls} waves with onp:null (pre-ONP-fielding waves)`);

const prov = {};
for (const list of [polls, tpp3, ldr]) for (const r of list) for (const tag of r.provenance || ["<missing>"]) prov[tag] = (prov[tag] || 0) + 1;
ck("provenance-present", "data", prov["<missing>"] == null, `provenance histogram: ${Object.entries(prov).map(([k, n]) => `${k} ${n}`).join(", ")}`);

const series = {}, pairs = {};
for (const r of ldr) { series[r.series] = (series[r.series] || 0) + 1; pairs[r.pair] = (pairs[r.pair] || 0) + 1; }
info("leadership-series", "data", `series: ${JSON.stringify(series)} — pairs: ${JSON.stringify(pairs)}`);
const KNOWN_LEADERS = /^(andrews|allan|carroll)-vs-(pesutto|battin|wilson)(-vs-pickering)?$/;
const badPairs = Object.keys(pairs).filter((p) => !KNOWN_LEADERS.test(p));
ck("leadership-pairs-known", "data", badPairs.length === 0, badPairs.length ? `unrecognised leadership pairs: ${badPairs.join(", ")}` : "all leadership pairs are the known era set");

// ---- generator / page synchrony -----------------------------------------------------
const genPage = (gen.match(/const PAGE = "([^"]+)"/) || [])[1];
ck("gen-page-path", "feature", genPage === PAGE_F, `generator PAGE = ${genPage} (this page)`);
const htmlHasEmbedded = /const POLL_DATA|const DATA|window\.__VIC|"polls":\[/.test(html);
info("data-embed-shape", "feature", `embedded dataset in page: ${htmlHasEmbedded ? "yes" : "no (page fetches or inlines another way)"}`);

// ---- charts: the standard §2 demand list (D1–D5, D13) --------------------------------
const FIG_RE = /<figure class="vp-chart"[^>]*aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/figure>/g;
const figures = [...html.matchAll(FIG_RE)].map((m) => ({ label: m[1], body: m[2] }));
const low = (s) => s.toLowerCase();
const fig2pp = figures.find((f) => /two-party/.test(low(f.label)));
const figFp = figures.find((f) => /first[ -]?pref/.test(low(f.label)));
const figLeaders = figures.filter((f) => /leader|premier|satisfaction|approval/.test(low(f.label)));

const figName = (i, f) => `f${i}-${(f.label.match(/(two-party|first preferences|leader|premier|approval|satisfaction|net)/i) || ["chart"])[0].toLowerCase().replace(/\s+/g, "-")}`;

ck("chart-figure-count", "feature", figures.length >= 4, `${figures.length} .vp-chart figures on the page (expect ≥4: 2PP, first preferences, two leaders)`);

// D1 — every wave dot's <title> carries firm + fieldwork span + value,
// and the published sample where one exists ("Firm, 20–27 May 2023 —
// measure 61.5 (n 1,004)"). Multi-day waves are a data-specific share, so
// the span demand is a FAIL only when the data says spans exist.
const multi = polls.filter((p) => p.fwStart && p.fwEnd && p.fwStart < p.fwEnd).length;
const multiShare = multi / (polls.length || 1);
figures.forEach((f, i) => {
  const id = figName(i, f);
  const titles = [...f.body.matchAll(/<title>([\s\S]*?)<\/title>/g)].map((m) => m[1].trim());
  ck(`chart-titles-present-${id}`, "feature", titles.length > 0, `${titles.length} <title> hovers in figure ${i} (${f.label.slice(0, 60)})`);
  if (!titles.length) return;
  const withVal = titles.filter((t) => /\d+(\.\d+)?\s*(\([^()]*\))?\s*$/.test(t));
  ck(`chart-titles-value-${id}`, "feature", withVal.length / titles.length >= 0.9, `${withVal.length}/${titles.length} titles end with the plotted value`);
  const withSpan = titles.filter((t) => /–| to /.test(t));
  const spanShare = withSpan.length / titles.length;
  if (multiShare >= 0.4) ck(`chart-titles-span-${id}`, "feature", spanShare >= 0.75, `${withSpan.length}/${titles.length} titles carry a fieldwork span (data has ${multi}/${polls.length} multi-day waves)`);
  const sampleRowsF = polls.filter((p) => typeof p.sample === "number").length / (polls.length || 1);
  const withN = titles.filter((t) => /\(?\bn\s?[= ]\s?[\d,]{3,}\)?/.test(t));
  if (sampleRowsF >= 0.5) ck(`chart-titles-sample-${id}`, "feature", withN.length / titles.length >= 0.4, `${withN.length}/${titles.length} titles name the sample (${sampleRowsF >= 0.5 ? Math.round(sampleRowsF * 100) : 0}% of waves publish one)`);
});

// D2 — end-of-line value labels on every series, every figure
figures.forEach((f, i) => {
  const id = figName(i, f);
  const vb = (f.body.match(/viewBox="0 0 ([\d.]+) [\d.]+"/) || [])[1];
  if (!vb) { ck(`chart-endlabels-${id}`, "feature", false, `figure ${i} has no parseable viewBox — cannot verify end labels`); return; }
  const w = +vb;
  const right = [...f.body.matchAll(/<text[^>]*x="([\d.]+)"[^>]*>([\d.]+)%?\u2212?[^<]*<\/text>/g)]
    .filter((m) => +m[1] > w * 0.8 && /^\d+(\.\d+)?%?$/.test(m[2].trim()));
  const need = f === figFp ? 4 : 1;
  ck(`chart-endlabels-${id}`, "feature", right.length >= need, `${right.length} value label(s) at the right plot edge in figure ${i}; ${need}+ required (every series's current value visible, main-page end-label convention)`);
});

// D3 — official-result reference markers where a result exists
ck("tpp-2022-election-marker", "feature", !!fig2pp && /2022/.test(fig2pp.body) && /55(\.0)?/.test(fig2pp.body), `2PP figure ${fig2pp ? (fig2pp.body.includes("2022") ? "marks" : "is MISSING") : "missing — no figure"} the 2022 election baseline (Labor 55.0)`);
ck("fp-2022-election-markers", "feature", !!figFp && /2022/.test(figFp.body), `first-preferences figure ${figFp ? (/2022/.test(figFp.body) ? "carries" : "MISSING") : "missing"} 2022 election reference marks (official statewide primaries)`);

// D4 — leadership-era boundary annotations on the leaders figures
{
  const names = ["Andrews", "Allan", "Carroll", "Pesutto", "Battin", "Wilson", "Pickering"];
  const leadText = figLeaders.map((f) => f.body).join(" ");
  const found = names.filter((n) => leadText.includes(n));
  ck("leader-era-markers", "feature", figLeaders.length > 0 && found.length >= 2, figLeaders.length ? `leaders figures name ${found.length} era figures (${found.join(", ") || "none"}) — premier/opposition era changes must be marked` : "no leaders figures found");
}

// D5 — axis vocabulary on every figure: year-ish x ticks, y ticks, U+2212
const negHyphen = figures.map((f, i) => i).filter((i) => /<text[^>]*>-\d/.test(figures[i].body));
ck("chart-ticks-u2212", "visual", negHyphen.length === 0, negHyphen.length ? `figures ${negHyphen.join(",")} render hyphen-minus negatives — U+2212 required` : "no hyphen-minus negatives inside chart figures");
figures.forEach((f, i) => {
  const id = figName(i, f);
  const ys = [...f.body.matchAll(/<text[^>]*>([−-]?\d+(\.\d+)?%?)\s*<\/text>/g)].length;
  const xs = [...f.body.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].filter((m) => /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|\b(19|20)\d\d\b|Election/.test(m[1])).length;
  ck(`chart-axes-${id}`, "visual", ys >= 3 && xs >= 3, `figure ${i}: ${ys} numeric y ticks, ${xs} date/event x labels`);
});

// D13 — ARIA on page-owned parts
ck("figure-aria-labels", "feature", figures.every((f) => f.label.trim().length > 10), `${figures.length} figures all carry a meaningful aria-label (role=img)`);
ck("table-caption", "feature", /<table[^>]*>[\s\S]*?<caption/.test(html), "poll table carries a <caption>");

// ---- interaction tier (D14 hover cards, D15 dot↔table wiring, D16 leaders) ----
// The page is generated + inline; check its DOM signature in the shipped
// html and fall back to the generator source for the script-side wiring.
{
  const src = html + "\n" + gen;
  // D14: custom hover-card machinery = tooltip styling + a host element the
  // script populates + pointer event wiring attached to dots.
  const tipCss = /\.vp-(tip|tooltip|htip|card)\b/.test(src);
  const tipHost = /class="vp-(tip|tooltip|htip|card)/.test(html) || /createElement\(["'](?:div|aside)["']\)[\s\S]{0,600}?vp-(tip|tooltip|htip)/.test(src);
  const ptrWiring = /addEventListener\(["'](pointerenter|pointerover|pointermove|mouseover)/.test(src);
  ck("hover-tip-machinery", "feature", tipCss && tipHost && ptrWiring,
    `custom hover-card signature — tooltip styling: ${tipCss ? "yes" : "NO"}, host element: ${tipHost ? "yes" : "NO"}, pointer wiring: ${ptrWiring ? "yes" : "NO"} (native <title> alone is not the main page's hover surface)`);

  // D15: dots carry wave keys; table rows carry anchor ids; a script
  // joins them (dataset/getAttribute + getElementById/querySelector).
  const WAVE_ATTR_RE = /<circle[^>]*data-(wave|key|fw|date|wave-key)="[^"]*"/g;
  let waveDots = 0, circles = 0;
  figures.forEach((f) => {
    circles += (f.body.match(/<circle\b/g) || []).length;
    waveDots += (f.body.match(WAVE_ATTR_RE) || []).length;
  });
  ck("dot-wave-keys", "feature", circles > 0 && waveDots / circles > 0.6,
    `${waveDots}/${circles} chart dots carry a wave-key data attribute (hover/click targets must be wave-keyed)`);
  const tblSeg = (() => { const h = html.indexOf("Every published poll"); return h >= 0 ? html.slice(h, Math.min(h + 120000, html.length)) : ""; })();
  const rowIds = (tblSeg.match(/<tr[^>]*id="[^"]+"/g) || []).length;
  ck("table-row-ids", "feature", rowIds >= polls.length,
    `${rowIds}/${polls.length} poll-table rows carry an anchor id for dot wiring`);
  const joiner = /\.dataset\.|getAttribute\(["']data-|getElementById\(|querySelector\(["']#/.test(src) && /(highlight|scrollIntoView|classList\.(add|toggle))/.test(src);
  ck("dot-table-joiner", "feature", joiner, `page JS joins dots to rows (dataset read + highlight/scroll behaviour) ${joiner ? "present" : "ABSENT"}`);

  // D16: leaders figures' dots also carry the wave-key attrs (first-class)
  const leadersCircles = figLeaders.reduce((n, f) => n + ((f.body.match(/<circle\b/g) || []).length), 0);
  const leadersKeyed = figLeaders.reduce((n, f) => n + ((f.body.match(WAVE_ATTR_RE) || []).length), 0);
  ck("leaders-dots-keyed", "feature", leadersCircles > 0 && leadersKeyed / leadersCircles > 0.6,
    `${leadersKeyed}/${leadersCircles} leader-chart dots carry wave keys (leaders join the interactive tier)`);
}

// D17 — next-expected-polls predictor strip under the hero
{
  const m = html.match(/<h[23][^>]*>[^<]*(next|expected)[^<]*<\/h[23]>([\s\S]{0,12000})/i)
    || html.match(/class="[^"]*vp-(next|cadence|predict)[^"]*"([\s\S]{0,12000})/i);
  const seg = m ? m.slice(m.length - 2).map((s) => s || "").join("") : "";
  const houses = Object.keys(firms).filter((f) => seg && seg.includes(f));
  const dateish = (seg.match(/\b(202[0-9])-(0[1-9]|1[0-2])-\d\d\b|Polling due|\bin ~?\d+ d|overdue|days?\b/g) || []).length;
  ck("next-polls-strip", "feature", !!m && houses.length >= 2 && dateish >= 2,
    m ? `next-polls strip found naming ${houses.length} houses (${houses.join(", ")}) with ${dateish} date/countdown tokens` : "NO next-expected-polls strip/section found under the hero (main page has its next-polls predictor; this page has none)");
}

// D7 — hero clauses: basis count + the 2022 baseline delta nearby
ck("hero-basis-clause", "feature", /two-party figures/i.test(text) || /published 2PPs?/i.test(text) || /published two-party/i.test(text), "the headline 2PP clause names its basis ('from N published two-party figures …')");
ck("hero-2022-delta", "feature", /2022/.test(text) && /(\d+(\.\d+)?\s*(points?|pts?)\s*(behind|ahead|above|below|off|short|of the 2022)|compared with 2022|vs 2022|against the 2022)/i.test(text), "hero/summary copy states the current blend's distance from the 2022 election result");

// D8 — a gist dek under every content h2
for (const want of EXPECTED_H2) {
  const at = html.indexOf(`<h2`);
  void at;
  const m = html.match(new RegExp(`<h2[^>]*>[^<]*${want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^<]*</h2>([\\s\\S]{0,3000})`));
  let okDek = false, got = "";
  if (m) {
    const seg = m[1].slice(0, m[1].search(/<(figure|table|h2)/i) >= 0 ? m[1].search(/<(figure|table|h2)/i) : m[1].length);
    const p = seg.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    if (p) { const t = p[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); got = t.slice(0, 80); okDek = t.length >= 40; }
  }
  ck(`section-dek-${want.toLowerCase().replace(/[^a-z]+/g, "-")}`, "feature", okDek, okDek ? `dek under "${want}": "${got}…"` : `no gist dek (≥40 chars) under "${want}" before its first figure/table`);
}

// D11 — "Every published poll" means every census row renders
{
  const h = html.indexOf("Every published poll");
  const seg = h >= 0 ? html.slice(h, Math.min(h + 60000, html.indexOf("<h2", h + 10) > 0 ? html.indexOf("<h2", h + 10) : html.length)) : "";
  const rows = (seg.match(/<tr[ >]/g) || []).length;
  ck("poll-table-census", "feature", h >= 0 && rows >= polls.length, `poll table renders ${rows} <tr> (header included) against a census of ${polls.length} published waves — one row per published poll, newest first`);
}

// D12 — phone rung is a reviewer-judged item (needs a renderer); leave the
// static facts on record so the judgement has evidence without a browser.
info("phone-rung-evidence", "visual", `<meta name="viewport"> present; table wrapper: ${/class="vp-twrap"/.test(html) ? "overflow-x host" : "none"}; page-owned CSS @media rules: ${(html.match(/@media[^{]*max-width/g) || []).length} — reviewer judges 390px/320px integrity by inspection (D12)`);

// ---- emit ---------------------------------------------------------------------------
const pack = {
  generated: new Date().toISOString(),
  pageBytes: html.length,
  checks,
  failed: checks.filter((c) => !c.ok).map((c) => c.id),
  inventory: { h2s, firms, series, pairs, newest, oldest, daysSinceNewest, counts: { polls: polls.length, tpp3: tpp3.length, leadership: ldr.length, tpp2Rows, sampleRows, srcRows } },
};
if (process.env.VP_PACK_OUT) {
  mkdirSync(path.dirname(process.env.VP_PACK_OUT), { recursive: true });
  writeFileSync(process.env.VP_PACK_OUT, JSON.stringify(pack, null, 2) + "\n");
}
console.log("VP_AUDIT " + JSON.stringify({ checks: checks.length, failed: pack.failed, daysSinceNewest }));
