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
