/* demosau-switching.mjs – DemosAU's "Voting Intention: Past Election Vote"
   chart, read back into numbers: for each 2025-vote group (ALP, L/NP,
   Greens, One Nation, others, didn't remember / didn't vote), the share now
   voting for each party. Called by .build/vote-switching.mjs.

   DemosAU prints this table only as a 100% stacked-bar chart and labels a
   segment only when it is wide enough to hold its number, so the text layer
   alone loses every small segment. The page is rendered instead and each bar
   measured – with poppler alone (pdftotext -bbox-layout for the words,
   pdftoppm for the pixels), so it runs wherever the DemosAU extractor does,
   on the laptop and on the CI runner (poppler-utils), with nothing else to
   install:
     - legend: the colour of the swatch just left of each party word, so the
       colours come from the chart itself, whatever order it lists them in;
     - rows: located from their labels left of the axis; the axis from its 0%
       and 100% ticks;
     - each row is sampled on four lines above and below its centre, clear of
       the data labels, at 300 dpi (~0.04 points a pixel), every pixel
       classified to the nearest legend colour.
   DemosAU charts whole percentages, so the measured shares land within a few
   hundredths of integers (within ~0.5 on the anti-aliased August 2026
   report) and are returned rounded; the printed labels are reproduced
   exactly.

   Usage: node .build/demosau-switching.mjs <report.pdf>   → JSON on stdout */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

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
  return [...t.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)].map((m, i) => ({
    n: i + 1, width: +m[1], height: +m[2],
    words: [...m[3].matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)]
      .map((w) => ({ x0: +w[1], top: +w[2], x1: +w[3], bottom: +w[4], text: dec(w[5]) })),
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

export function measure(pdf) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "demosau-sw-"));
  try {
    const pages = pagesOf(pdf, tmp);
    const page = pages.find((p) => p.words.some((w, i) => w.text === "Past" && p.words[i + 1]?.text === "Election" && p.words[i + 2]?.text === "Vote"));
    if (!page) return { error: "no Past Election Vote page" };
    const words = page.words;
    const ticks = words.filter((w) => w.text === "0%" || w.text === "100%");
    const axisTop = Math.max(...ticks.map((w) => w.top));
    const axis = ticks.filter((w) => Math.abs(w.top - axisTop) < 3);
    const xl = Math.min(...axis.map((w) => w.x0)) - 12, xr = Math.max(...axis.map((w) => w.x1)) + 12;
    const barLeft = Math.min(...axis.filter((w) => w.text === "0%").map((w) => w.x0));
    const img = renderPage(pdf, page.n, tmp);
    const sx = img.w / page.width, sy = img.h / page.height;
    // legend: party words over the chart, each coloured by its swatch
    const legendWords = words.filter((w) => PARTY[w.text] && w.x0 > barLeft && w.bottom < axisTop);
    const legend = [];
    for (const w of legendWords) {
      const counts = new Map();
      const yMid = (w.top + w.bottom) / 2;
      for (let y = Math.round((yMid - 3) * sy); y <= Math.round((yMid + 3) * sy); y++)
        for (let x = Math.round((w.x0 - 16) * sx); x <= Math.round((w.x0 - 2) * sx); x++) {
          const c = img.px(x, y);
          if (c.every((v) => v > 0.9)) continue;                 // background
          const k = c.map((v) => Math.round(v * 40)).join(",");
          counts.set(k, (counts.get(k) || 0) + 1);
        }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) legend.push({ key: PARTY[w.text], rgb: top[0].split(",").map((v) => +v / 40), y: w.bottom });
    }
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
      const shares = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, 100 * v / tot]));
      for (const v of Object.values(shares)) fit = Math.max(fit, Math.abs(v - Math.round(v)));
      out[rowKey(r.text)] = Object.fromEntries(Object.entries(shares).filter(([, v]) => Math.round(v) > 0).map(([k, v]) => [k, Math.round(v)]));
    }
    return { page: page.n, rows: out, maxOffInteger: +fit.toFixed(2), rowLabels: rows.map((r) => r.text) };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const f of process.argv.slice(2)) console.log(JSON.stringify(measure(f)));
}
