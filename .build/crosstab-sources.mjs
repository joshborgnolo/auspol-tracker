/* crosstab-sources.mjs – where each pollster's crosstabs are read from, shared
   by .build/vote-switching.mjs (the 2025-vote table) and
   .build/demographics.mjs (gender, age, education…). One reader per source,
   so the two builders can never disagree about a wave's table.

     YouGov    – the "Generic" crosstab chart embedded in each Pulse article
                 (Sky News Pulse Feb–Jul 2026, News24 Pulse since), read
                 exactly from the chart's own data at e.infogram.com. News24
                 waves: the chart id from the News24 extractor's cache for the
                 wave (.build/news24-src/news24-<date>.json, the chart classed
                 "crosstab"), which the laptop's Chrome run writes – a CI run
                 can't read the article, so its waves wait for that run. Sky
                 News pages need a browser to read at all, so those ids are
                 recorded here.
     DemosAU   – the wave's report PDF, read from the copy extract-demosau.mjs
                 left in the temp dir, else fetched through demosau.com's
                 SiteGround captcha with the extractor's own solver
                 (demosau-fetch.mjs); a failed fetch is a retry, never a skip.
     Resolve   – the SMH Political Monitor interactive's data.json (the
                 source extract-resolve-rpm.mjs reads), values obfuscated per
                 point and decoded exactly as that extractor does.
     RedBridge – the report text extract-redbridge.mjs caches in
                 .build/redbridge-src/ (read by demographics.mjs itself). */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { infographicDataOf } from "./infogram.mjs";
import { fetchBuffer, passSgCaptcha } from "./demosau-fetch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..");

// ---- YouGov -------------------------------------------------------------------
export const IG = (id) => `https://e.infogram.com/${id}?src=embed`;
/* Crosstab chart ids read by hand from each article (Sky News pages need a
   browser; the News24 waves before the extractor's cache kept them). New
   News24 waves need no entry here. */
export const KNOWN_IG = {
  "2026-02-10": "_/ZmzvfoQcPMj4PREkMRoQ", "2026-02-24": "_/ihQUqVtPBNqqg4cvnJMI",
  "2026-03-10": "_/pb7kijCuicNCIZB3PVwM", "2026-03-24": "_/oLs7Ez236QuKo9b8951m",
  "2026-04-07": "_/5PSbKtbHyzvhiC0xbRSl", "2026-04-21": "_/GM5wSTEgnFLWxZ5bKCB4",
  "2026-05-05": "_/xlAzTHMulISJRy1rkc2C", "2026-05-19": "_/rpPgjmCBFb9tgpiTDMJW",
  "2026-06-02": "_/zSPbFJ7s5bfliWLjxj21", "2026-06-30": "_/adAygP6VBs84ueM4jN4C",
  "2026-07-14": "_/pL018pKKkRErkzkegdv6", "2026-07-28": "_/cEkYPVrn9ybfCGXAflmL",
  "2026-08-10": "_/bfCWmJWwJrLP0zgZOSEt", "2026-08-24": "_/YM46DvOTftyx9pNzV67y",
  "2026-09-08": "_/tffIGyctHfK10P86g4Pb", "2026-09-21": "_/XdWD62anjLF6u5scKfkU",
};
/* Where a YouGov wave's crosstab lives, or why it can't be read (yet). */
export function youGovSource(date) {
  if (KNOWN_IG[date]) return { ids: [KNOWN_IG[date]] };
  const f = path.join(ROOT, ".build", "news24-src", `news24-${date}.json`);
  if (!fs.existsSync(f)) return { pending: "no News24 extractor cache for this wave yet" };
  const ig = JSON.parse(fs.readFileSync(f, "utf8")).infogram || {};
  const ids = ig.ids || [], kinds = ig.kinds || [];
  if (!ids.length) return { pending: "the wave's chart ids aren't known yet (read by the laptop's Chrome run)" };
  // the chart the extractor classed "crosstab" first, then every other one
  const k = kinds.indexOf("crosstab");
  return { ids: k >= 0 ? [ids[k], ...ids.filter((_, i) => i !== k)] : ids };
}
/* The crosstab sheet of a chart: the one with 2025-vote columns and a One
   Nation row. Returned raw – head (column labels) and rows [label, …cells]. */
export function crosstabOfHtml(html) {
  const data = infographicDataOf(html);
  const ents = data?.elements?.content?.content?.entities || {};
  for (const e of Object.values(ents)) {
    const cd = e?.props?.chartData;
    if (e?.type !== "CHART" || !cd?.data) continue;
    for (const sheet of cd.data) {
      if (!Array.isArray(sheet) || !Array.isArray(sheet[0])) continue;
      const rows = sheet.map((r) => r.map((c) => String(c?.value ?? c ?? "").trim()));
      if (rows[0].filter((h) => /2025/.test(h)).length < 4) continue;
      if (!rows.some((r) => /^one nation$/i.test(r[0]))) continue;
      return { head: rows[0], rows: rows.slice(1).filter((r) => r[0]),
               title: (html.match(/<title>(.*?)<\/title>/s) || [])[1]?.trim() };
    }
  }
  return null;
}
export async function youGovCrosstab(ids) {
  for (const id of ids) {
    let html;
    try { html = await (await fetch(IG(id), { headers: { "User-Agent": "Mozilla/5.0" } })).text(); } catch { continue; }
    const t = crosstabOfHtml(html);
    if (t) return { id, source: IG(id).replace("?src=embed", ""), ...t };
  }
  return null;
}
/* YouGov's party rows onto the site's keys; independents, other parties and
   any party the house names separately (Community Strong) fold into oth. */
export const ygParty = (r) => {
  const s = r.toLowerCase().trim();
  if (s === "labor") return "alp";
  if (s === "coalition") return "lnp";
  if (s === "one nation") return "onp";
  if (/greens/.test(s)) return "grn";
  return "oth";
};

// ---- DemosAU ------------------------------------------------------------------
export const isPdf = (f) => {
  try { const b = Buffer.alloc(5); const fd = fs.openSync(f, "r"); fs.readSync(fd, b, 0, 5, 0); fs.closeSync(fd); return b.toString() === "%PDF-"; }
  catch { return false; }
};
/* The wave's report PDF: its releaseUrl (or url) where it links one, else the
   report the extractor read for that fieldwork date (its cache names it by
   slug, and DemosAU files reports under the month they went up). */
export function demosauPdfUrls(p) {
  const urls = [p.releaseUrl, p.url].filter((u) => /^https:\/\/demosau\.com\/wp-content\/.+\.pdf$/i.test(u || ""));
  const dir = path.join(ROOT, ".build", "demosau-src");
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!f.endsWith(".json")) continue;
    let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
    if (j.date !== p.date || !j.slug) continue;
    const [y, m] = p.date.split("-").map(Number);
    for (const [yy, mm] of [[y, m], m === 12 ? [y + 1, 1] : [y, m + 1]])
      urls.push(`https://demosau.com/wp-content/uploads/${yy}/${String(mm).padStart(2, "0")}/${encodeURIComponent(j.slug)}.pdf`);
  }
  return [...new Set(urls)];
}
/* A local copy of the report: the extractor's own download first, else fetched
   into `tmp` through the site's bot wall (demosau-fetch.mjs, the extractor's
   own fetch). Null when no candidate yields a real PDF. */
export async function demosauReport(p, tmp) {
  for (const url of demosauPdfUrls(p)) {
    const slug = decodeURIComponent(url.split("/").pop().replace(/\.pdf$/i, ""));
    const extracted = path.join(os.tmpdir(), `demosau-${slug}.pdf`);
    if (isPdf(extracted)) return { url, file: extracted };
    let buf;
    try {
      buf = await fetchBuffer(url);
      const html = buf.subarray(0, 5).toString() === "%PDF-" ? "" : buf.toString("utf8");
      if (html.includes("sgcaptcha") && (await passSgCaptcha(html, url))) buf = await fetchBuffer(url);
    } catch { continue; }
    if (buf.subarray(0, 5).toString() !== "%PDF-") continue;
    const f = path.join(tmp, `${slug}.pdf`);
    fs.writeFileSync(f, buf);
    return { url, file: f };
  }
  return null;
}

// ---- Resolve -------------------------------------------------------------------
export const RESOLVE_DATA = "https://www.smh.com.au/interactive/2026/political-monitor/site/data/data.json";
export const RESOLVE_PAGE = "https://www.smh.com.au/national/resolve-political-monitor-20210322-p57cvx.html";
/* extract-resolve-rpm.mjs's decodeUx, verbatim: the 2026 interactive ships each
   point as base36 of (value XOR 123) with the fractional tail verbatim. */
export const decodeUx = (s) => {
  s = String(s);
  if (s.includes(".")) {
    const [i, f] = s.split(".");
    return parseFloat(`${parseInt(i, 36) ^ 123}.${f}`);
  }
  return parseInt(s, 36) ^ 123;
};
const XOR_VALUE = /^-?[0-9a-z]+(\.[0-9]+)?$/i;
export async function resolveData() {
  const res = await fetch(RESOLVE_DATA, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" } });
  if (!res.ok) throw new Error(`Resolve data.json HTTP ${res.status}`);
  const d = await res.json();
  // the extractor's rule: a payload's values must all be xor-shaped, or the
  // upstream scheme has changed and nothing is decoded on a guess
  const q = (d.sections || []).find((s) => s.id === "Q5");
  if (!q) throw new Error("Resolve data.json has no Q5 (primary vote) section");
  for (const a of q.answers || [])
    for (const g of [...(a.age || []), ...(a.gender || [])])
      for (const t of g.timeseries || [])
        if (!XOR_VALUE.test(String(t.value))) throw new Error(`Resolve value "${t.value}" isn't xor-shaped – the obfuscation changed`);
  return q;
}
