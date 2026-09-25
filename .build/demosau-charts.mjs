/* demosau-charts.mjs – DemosAU's report charts read back into numbers.
   DemosAU prints its voting-intention breakdowns (by 2025 vote, gender, age,
   education…) only as 100% stacked-bar charts, and labels a segment only
   when it is wide enough to hold its number, so the text layer alone loses
   every small segment. The page is rendered instead and each bar measured –
   with poppler alone (pdftotext -bbox-layout for the words, pdftoppm for the
   pixels), so it runs wherever the DemosAU extractor does, on the laptop and
   on the CI runner (poppler-utils), with nothing else to install:
     - a chart is the region under its heading ("Gender", "Age",
       "Education", or the whole "Past Election Vote" page) down to the next
       heading;
     - legend: the colour of the swatch just left of each party word, so the
       colours come from the chart itself, whatever order it lists them in;
     - rows: located from their labels left of the axis; the axis from its
       0% and 100% ticks;
     - each row is sampled on four lines above and below its centre, clear of
       the data labels, at 300 dpi (~0.04 points a pixel), every pixel
       classified to the nearest legend colour.
   DemosAU charts whole percentages, so the measured shares land within a few
   hundredths of integers (within ~0.5 on the anti-aliased August 2026
   report) and are returned rounded; the printed labels are reproduced
   exactly.

   measure(pdf)                 the "Past Election Vote" chart (vote switching)
   measureCharts(pdf, names)    named breakdown charts, e.g. ["Gender", "Age"]
   CLI: node .build/demosau-charts.mjs <report.pdf> [chart…]  → JSON on stdout */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const RES = 300;
const PARTY = { ALP: "alp", GRN: "grn", Grn: "grn", OTH: "oth", Oth: "oth", "L/NP": "lnp", LNP: "lnp", ONP: "onp" };

const rowKey = (label) => {
  const l = label.toLowerCase();
  if (l.startsWith("alp")) return "alp";
  if (l.startsWith("l/np") || l.startsWith("lnp")) return "lnp";
  if (l.startsWith("grn")) return "grn";
  if (l.startsWith("onp")) return "onp";
  if (l.startsWith("oth")) return "oth";
  return "dnr"; // "Did Not Remember", "No recall/Not voted", "Don't Recall/Didn't Vote"
};

// poppler lives on PATH in CI and under Homebrew on the laptop (launchd's
// PATH has neither), the same fallbacks extract-demosau.mjs uses
function bin(name) {
  for (const b of [name, `/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, `/usr/bin/${name}`]) {
    try { execFileSync(b, ["-v"], { stdio: "ignore" }); return b; } catch (e) { if (e.code !== "ENOENT") return b; }
  }
  throw new Error(`${name} not found (install poppler)`);
}

function pagesOf(pdf, tmp) {
  const html = path.join(tmp, "bbox.html");
  execFileSync(bin("pdftotext"), ["-bbox-layout", pdf, html]);
  const t = fs.readFileSync(html, "utf8");
  const dec = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const wordsOf = (s) => [...s.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)]
    .map((w) => ({ x0: +w[1], top: +w[2], x1: +w[3], bottom: +w[4], text: dec(w[5]) }));
  return [...t.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)].map((m, i) => ({
    n: i + 1, width: +m[1], height: +m[2], words: wordsOf(m[3]),
    // each text line whole, so a chart heading is a line that is just its name
    lines: [...m[3].matchAll(/<line[^>]*>([\s\S]*?)<\/line>/g)].map((l) => {
      const ws = wordsOf(l[1]);
      return { text: ws.map((w) => w.text).join(" "), top: Math.min(...ws.map((w) => w.top)), bottom: Math.max(...ws.map((w) => w.bottom)) };
    }).filter((l) => l.text),
  }));
}

// pdftoppm's default output is binary PPM (P6): a three-token header, then RGB
function renderPage(pdf, n, tmp) {
  const prefix = path.join(tmp, "pg");
  execFileSync(bin("pdftoppm"), ["-f", String(n), "-l", String(n), "-r", String(RES), pdf, prefix]);
  const f = fs.readdirSync(tmp).find((x) => x.startsWith("pg-") && x.endsWith(".ppm"));
  const buf = fs.readFileSync(path.join(tmp, f));
  let pos = 0; const tok = [];
  while (tok.length < 4) {
    while (/\s/.test(String.fromCharCode(buf[pos]))) pos++;
    if (buf[pos] === 0x23) { while (buf[pos] !== 0x0a) pos++; continue; } // # comment
    let s = ""; while (!/\s/.test(String.fromCharCode(buf[pos]))) s += String.fromCharCode(buf[pos++]);
    tok.push(s);
  }
  pos++;
  const [magic, w, h] = [tok[0], +tok[1], +tok[2]];
  if (magic !== "P6") throw new Error(`unexpected ${magic} from pdftoppm`);
  return { w, h, px: (x, y) => { const i = pos + 3 * (y * w + x); return [buf[i] / 255, buf[i + 1] / 255, buf[i + 2] / 255]; } };
}

/* One chart: the part of `page` between yTop and yBottom. Rows keyed by
   rowKey(label); shares rounded to whole percentages. */
function measureRegion(page, img, yTop, yBottom, rowKey) {
  const words = page.words.filter((w) => w.top >= yTop && w.bottom <= yBottom);
  const ticks = words.filter((w) => w.text === "0%" || w.text === "100%");
  if (!ticks.length) return { error: "no axis in the chart region" };
  const axisTop = Math.max(...ticks.map((w) => w.top));
  const axis = ticks.filter((w) => Math.abs(w.top - axisTop) < 3);
  const xl = Math.min(...axis.map((w) => w.x0)) - 12, xr = Math.max(...axis.map((w) => w.x1)) + 12;
  // the bars start under the CENTRE of the "0%" tick; row labels can end as
  // far right as that tick's left edge (DemosAU's breakdown charts do)
  const zero = axis.filter((w) => w.text === "0%");
  if (!zero.length) return { error: "no 0% tick in the chart region" };
  const barLeft = Math.min(...zero.map((w) => (w.x0 + w.x1) / 2)) - 3;
  const sx = img.w / page.width, sy = img.h / page.height;
  // legend: party words over the chart, each coloured by its swatch
  const legend = [];
  for (const w of words.filter((w) => PARTY[w.text] && w.x0 > barLeft && w.bottom < axisTop)) {
    const counts = new Map();
    const yMid = (w.top + w.bottom) / 2;
    for (let y = Math.round((yMid - 3) * sy); y <= Math.round((yMid + 3) * sy); y++)
      // the swatch sits 5–30pt left of its word depending on the report's
      // style; text pixels (a neighbouring word) are near-black, never a swatch
      for (let x = Math.round((w.x0 - 30) * sx); x <= Math.round((w.x0 - 1) * sx); x++) {
        const c = img.px(x, y);
        if (c.every((v) => v > 0.9) || Math.max(...c) < 0.2) continue;   // background / text
        const k = c.map((v) => Math.round(v * 40)).join(",");
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) legend.push({ key: PARTY[w.text], rgb: top[0].split(",").map((v) => +v / 40), y: w.bottom });
  }
  if (!legend.length) return { error: "no legend in the chart region" };
  const legendBottom = Math.max(...legend.map((l) => l.y));
  // rows: the labels left of the axis, one per bar (a wrapped label joins its row)
  const lines = new Map();
  for (const w of words) {
    if (w.x1 < barLeft - 2 && w.top > legendBottom && w.top < axisTop - 5) {
      const k = Math.round((w.top + w.bottom) / 2 / 3);
      if (!lines.has(k)) lines.set(k, []);
      lines.get(k).push(w);
    }
  }
  const rows = [];
  for (const [, ws] of [...lines.entries()].sort((a, b) => a[0] - b[0])) {
    ws.sort((a, b) => a.x0 - b.x0);
    const y = ws.reduce((s, w) => s + (w.top + w.bottom) / 2, 0) / ws.length;
    const text = ws.map((w) => w.text).join(" ");
    if (rows.length && y - rows[rows.length - 1].y < 14) {
      const r = rows[rows.length - 1];
      rows[rows.length - 1] = { text: r.text + " " + text, y: (r.y + y) / 2 };
    } else rows.push({ text, y });
  }
  const pitch = rows.length > 1 ? Math.min(...rows.slice(1).map((r, i) => r.y - rows[i].y)) : 40;
  const out = {}; let fit = 0;
  for (const r of rows) {
    const counts = {}; let tot = 0;
    for (const f of [-0.30, -0.22, 0.22, 0.30]) {
      const y = Math.floor((r.y + f * pitch) * sy);
      for (let x = Math.floor(xl * sx); x < Math.floor(xr * sx); x++) {
        const p = img.px(x, y);
        let best = null, bd = 9;
        for (const l of legend) {
          const d = (p[0] - l.rgb[0]) ** 2 + (p[1] - l.rgb[1]) ** 2 + (p[2] - l.rgb[2]) ** 2;
          if (d < bd) { best = l.key; bd = d; }
        }
        if (bd < 0.02) { counts[best] = (counts[best] || 0) + 1; tot++; }
      }
    }
    if (!tot) continue;
    const shares = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, 100 * v / tot]));
    for (const v of Object.values(shares)) fit = Math.max(fit, Math.abs(v - Math.round(v)));
    out[rowKey(r.text)] = Object.fromEntries(Object.entries(shares).filter(([, v]) => Math.round(v) > 0).map(([k, v]) => [k, Math.round(v)]));
  }
  return { rows: out, maxOffInteger: +fit.toFixed(2), rowLabels: rows.map((r) => r.text) };
}

/* How far off whole percentages a chart may read and still be trusted. The
   reports print whole numbers, so a sound reading lands within a few tenths
   (every chart read in 2026: 0.12 at most); a layout the measurer doesn't
   know lands further off, and both builders keep that wave pending. */
export const FIT_LIMIT = 0.6;

/* The "Voting Intention: Past Election Vote" chart – the whole page. */
export function measure(pdf) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "demosau-sw-"));
  try {
    const pages = pagesOf(pdf, tmp);
    const page = pages.find((p) => p.words.some((w, i) => w.text === "Past" && p.words[i + 1]?.text === "Election" && p.words[i + 2]?.text === "Vote"));
    if (!page) return { error: "no Past Election Vote page" };
    const img = renderPage(pdf, page.n, tmp);
    const r = measureRegion(page, img, 0, page.height, rowKey);
    return r.error ? r : { page: page.n, ...r };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* Breakdown charts by heading. A chart runs from its heading line (a line
   that is exactly its name) to the next known heading on the page, or the
   page's foot; row labels are returned as printed. */
const HEADINGS = ["Gender", "Age", "Education", "Income", "Location", "State", "Housing Tenure", "Language Status"];
export function measureCharts(pdf, names) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "demosau-ch-"));
  try {
    const pages = pagesOf(pdf, tmp);
    const out = {}, rendered = new Map();
    for (const name of names) {
      /* A heading line can recur (a methodology page lists "Education" among
         its weighting variables), so every page carrying it is tried and the
         first whose region reads as a chart – an axis and a legend – wins. */
      out[name] = { error: `no "${name}" chart` };
      for (const page of pages.filter((p) => p.lines.some((l) => l.text === name))) {
        const head = page.lines.find((l) => l.text === name);
        const next = page.lines.filter((l) => HEADINGS.includes(l.text) && l.top > head.bottom).sort((a, b) => a.top - b.top)[0];
        const yBottom = next ? next.top : page.height;
        if (!page.words.some((w) => w.text === "100%" && w.top > head.top && w.bottom <= yBottom)) continue;
        if (!rendered.has(page.n)) {
          const sub = path.join(tmp, `p${page.n}`); fs.mkdirSync(sub);
          rendered.set(page.n, renderPage(pdf, page.n, sub));
        }
        // from the heading's TOP: a large heading's box can reach the legend
        const r = measureRegion(page, rendered.get(page.n), head.top, yBottom, (t) => t);
        if (!r.error && Object.keys(r.rows).length) { out[name] = { page: page.n, ...r }; break; }
        out[name] = r;
      }
    }
    return out;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// (compare as URLs: the repo path has a space, which import.meta.url encodes)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [f, ...names] = process.argv.slice(2);
  console.log(JSON.stringify(names.length ? measureCharts(f, names) : measure(f)));
}
