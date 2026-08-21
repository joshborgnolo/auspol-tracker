/* build.mjs – build "NEW Auspol Tracker (Standalone).html" from source.
   One command, reproducible from the repo alone:
       node .build/newtracker/build.mjs

   What changed vs the old pack.mjs: that script read the OUTPUT file, swapped a
   few gzip+base64 blobs inside it and wrote it back, so the artefact was its own
   input and could never be rebuilt from scratch. This builds it from source
   every time, and ships no toolchain:
     - JSX is transpiled HERE, at build time (Babel standalone, ~80ms in node),
       instead of shipping a 3.1MB in-browser transformer to every visitor.
     - React is the PRODUCTION build (142KB) instead of development (1.19MB).
     - Fonts are the latin subsets only; the vietnamese and latin-ext faces
       never matched a glyph on this page.
     - Plain inline text, not gzip+base64, so ordinary server compression works
       on it (base64-of-gzip is near-incompressible). */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validate } from "./validate.mjs";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const OUT = path.join(ROOT, "NEW Auspol Tracker (Standalone).html");
const A = (f) => path.join(HERE, "assets", f);

/* ---- 1. the data must be sound before anything is built ---------------- */
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
const { errors, exempted, orphans } = validate(DATA);
if (errors.length) {
  console.error(`\ndata/polls.json – ${errors.length} problem(s), build stopped:`);
  errors.forEach((e) => console.error(`  ${e.type.padEnd(13)} ${e.poll} – ${e.detail}`));
  process.exit(1);
}
console.log(`validated ${DATA.polls.length} polls · ${exempted.length} documented exceptions · ${orphans.length} leadership-only rows`);

/* ---- 2. regenerate the derived dataset --------------------------------- */
execFileSync(process.execPath, [path.join(HERE, "gen-data.mjs")], { stdio: ["ignore", "ignore", "inherit"] });

/* ---- 3. source modules, in load order ---------------------------------- */
// plain scripts first (they define the window aliases every component needs)
const PLAIN = ["9f09dca2-bd46-49a8-8ae1-51847608cf92.js", "ed2260de-5b11-4bd5-8a8d-a391156c05ee.js"];
const JSX = [
  "08b413e7-8dbe-49bf-8932-a479f8d98f54.js",  // chart toolkit
  "052e810c-b1c8-4847-a954-426d3af38e6d.jsx", // tweaks panel
  "a11e1559-f455-44d5-8a31-6699de4ef310.js",  // panels
  "d1a1d215-370c-4ebc-878b-7eeea9ad8102.js",  // tabbed views
  "wm-story.jsx",                             // the wordmark dial, replayed
  "73de0c58-f11f-4793-9f90-77e583ab051b.js",  // header, hero, mount
];

const Babel = require("./vendor/babel-standalone.js");
const transpile = (code, name) =>
  Babel.transform(code, { presets: [["react", { runtime: "classic" }]], filename: name, compact: false }).code;

/* An inline <script> ends at the first literal "</script", wherever it appears
   – including inside a JS string. Escaping the slash is inert in JS. */
const inlineJs = (code) => code.replace(/<\/script/gi, "<\\/script");

/* ---- 4. template ------------------------------------------------------- */
let html = fs.readFileSync(path.join(HERE, "template.html"), "utf8");

// -- fonts: 21 @font-face rules over 9 files -> 3 latin faces, inlined --
const FONTS = [
  { file: "newsreader-latin.woff2",        family: "Newsreader",  style: "normal", weight: "400 600" },
  { file: "newsreader-italic-latin.woff2", family: "Newsreader",  style: "italic", weight: "400 500" },
  // Public Sans is a variable face: one file serves the whole 400-800 range,
  // which is why the old CSS pointed five per-weight rules at the same uuid.
  { file: "publicsans-latin.woff2",        family: "Public Sans", style: "normal", weight: "400 800" },
];
const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const faceCss = FONTS.map((f) => {
  const b64 = fs.readFileSync(path.join(HERE, "fonts", f.file)).toString("base64");
  return `@font-face {
  font-family: '${f.family}';
  font-style: ${f.style};
  font-weight: ${f.weight};
  font-display: swap;
  src: url(data:font/woff2;base64,${b64}) format('woff2');
  unicode-range: ${LATIN};
}`;
}).join("\n");

const faceStart = html.indexOf("@font-face");
const faceEnd = html.lastIndexOf("}", html.indexOf("</style>", faceStart)) + 1;
if (faceStart < 0 || faceEnd <= faceStart) throw new Error("font block not found");
html = html.slice(0, faceStart) + faceCss + html.slice(faceEnd);

// -- head: drop the vestigial Google preconnects (every font is inlined; these
//    were two pointless handshakes to Google on a page that works offline),
//    and give it a tab icon + a share card --
html = html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>/g, "");

/* Tab icon: the masthead glyph itself, drawn from the same aggregates and the
   same geometry, so it re-draws with the data instead of drifting away from it.
   The old icon was a freehand approximation - wrong radius, three invented
   graduations, no needle, eyeballed hex.

   Two deliberate departures, both forced by 16px:
     - strokes are ~2.4x the on-page weights, or the 1.4-unit arc renders at
       half a pixel and disappears;
     - the pivot dot is dropped. It is illegible at this size, and its dark ink
       would vanish against a dark tab bar anyway.
   Colours are converted from the page's own oklch tokens rather than guessed. */
function oklchHex(L, C, Hdeg) {
  const h = (Hdeg * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, sp = s_ ** 3;
  const lin = [ 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * sp,
               -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * sp,
               -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * sp];
  return "#" + lin.map((c) => {
    c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, "0");
  }).join("");
}
const PARTY_HEX = {
  alp: oklchHex(0.55, 0.150, 27), lnp: oklchHex(0.50, 0.095, 250),
  grn: oklchHex(0.60, 0.120, 150), onp: oklchHex(0.66, 0.130, 58),
};

function buildFavicon() {
  // pull the derived series straight out of the asset gen-data just wrote
  const src = fs.readFileSync(A("9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8");
  const grab = (name) => {
    const i = src.indexOf("const " + name + " = ");
    if (i < 0) throw new Error("favicon: " + name + " not found in dataset");
    return JSON.parse(src.slice(i + name.length + 9, src.indexOf("\n", i)).replace(/;$/, ""));
  };
  const aggPrimary = grab("aggPrimary"), agg2pp = grab("agg2pp"), alt2pp = grab("alt2pp");

  // --- graduations: latest primary aggregate, tallest first (as on the page) ---
  const lp = aggPrimary[aggPrimary.length - 1];
  const glyph = ["alp", "lnp", "grn", "onp"].map((id) => ({ id, v: lp[id] }))
    .sort((a, b) => b.v - a.v);
  const vs = glyph.map((p) => p.v), gmin = Math.min(...vs), gmax = Math.max(...vs);
  const MIN_H = 5, MAX_H = 10.5;
  glyph.forEach((p) => { p.h = gmax === gmin ? MAX_H : MIN_H + ((p.v - gmin) / (gmax - gmin)) * (MAX_H - MIN_H); });

  // --- needle: 2PP against Labor's strongest challenger ---
  const g2 = agg2pp[agg2pp.length - 1];
  const gon = alt2pp.alp_on && alt2pp.alp_on[alt2pp.alp_on.length - 1];
  const cands = [{ id: "lnp", lab: g2.alp, opp: g2.lnp }];
  if (gon) cands.push({ id: "onp", lab: gon.a, opp: gon.b });
  const top = cands.slice().sort((x, y) => y.opp - x.opp)[0];
  const margin = top.lab - top.opp;
  const needleDeg = -Math.max(-1, Math.min(1, margin / 12)) * 34;
  const needleHex = margin >= 0 ? PARTY_HEX.alp : PARTY_HEX[top.id];

  // --- geometry, identical to the masthead ---
  const GC = { cx: 22, cy: 24.5, r: 12 }, BAR_ANGLES = [-54, -18, 18, 54];
  const polar = (deg, r) => ({
    x: +(GC.cx + Math.sin((deg * Math.PI) / 180) * r).toFixed(2),
    y: +(GC.cy - Math.cos((deg * Math.PI) / 180) * r).toFixed(2),
  });
  const arc = (d1, d2) => {
    const a = polar(d1, GC.r), b = polar(d2, GC.r);
    return `M ${a.x} ${a.y} A ${GC.r} ${GC.r} 0 0 1 ${b.x} ${b.y}`;
  };
  const pts = [];   // every drawn endpoint, for a bbox that can't clip
  const parts = [
    `<path d='${arc(-90, 0)}' fill='none' stroke='${PARTY_HEX.alp}' stroke-width='3.4' stroke-linecap='round'/>`,
    `<path d='${arc(0, 90)}' fill='none' stroke='${PARTY_HEX[top.id]}' stroke-width='3.4' stroke-linecap='round'/>`,
  ];
  for (let d = -90; d <= 90; d += 15) pts.push(polar(d, GC.r));
  glyph.forEach((p, i) => {
    const a = BAR_ANGLES[i], inner = polar(a, GC.r + 2.4), outer = polar(a, GC.r + 2.4 + p.h);
    pts.push(inner, outer);
    parts.push(`<line x1='${inner.x}' y1='${inner.y}' x2='${outer.x}' y2='${outer.y}' stroke='${PARTY_HEX[p.id]}' stroke-width='4.6' stroke-linecap='butt'/>`);
  });
  const tip = polar(needleDeg, 8.6);
  pts.push(tip, { x: GC.cx, y: GC.cy });
  parts.push(`<line x1='${GC.cx}' y1='${GC.cy}' x2='${tip.x}' y2='${tip.y}' stroke='${needleHex}' stroke-width='3' stroke-linecap='round'/>`);

  /* Square viewBox derived from what is actually drawn, padded by the widest
     stroke's half-width. Hardcoding it clipped the longest graduation: the
     favicon's heavier 4.6-unit stroke reaches ~1.9 units further out than the
     centreline, which a bbox of the endpoints alone does not see. */
  const HALF = 4.6 / 2 + 0.6;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs) - HALF, x1 = Math.max(...xs) + HALF;
  const y0 = Math.min(...ys) - HALF, y1 = Math.max(...ys) + HALF;
  const side = Math.max(x1 - x0, y1 - y0);
  const vb = [ ((x0 + x1) / 2 - side / 2).toFixed(2), ((y0 + y1) / 2 - side / 2).toFixed(2),
               side.toFixed(2), side.toFixed(2) ].join(" ");
  return { svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}'>${parts.join("")}</svg>`,
           note: `${glyph.map((p) => p.id + " " + p.v.toFixed(1)).join(", ")} · needle ${needleDeg.toFixed(1)}deg vs ${top.id}` };
}

const fav = buildFavicon();
console.log("  favicon:", fav.note);
const favicon = encodeURIComponent(fav.svg);

html = html.replace('<meta property="og:type" content="website">',
  `<meta property="og:type" content="website">
  <meta property="og:image" content="assets/auspol-card.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#f6f1e7" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#14110d" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="data:image/svg+xml,${favicon}">`);

/* ---- 5. inline every script ------------------------------------------- */
const parts = [];
for (const f of ["react.production.min.js", "react-dom.production.min.js"])
  parts.push(`<script>${inlineJs(fs.readFileSync(path.join(HERE, "vendor", f), "utf8"))}</script>`);
for (const f of PLAIN)
  parts.push(`<script>${inlineJs(fs.readFileSync(A(f), "utf8"))}</script>`);
for (const f of JSX)
  parts.push(`<script>${inlineJs(transpile(fs.readFileSync(A(f), "utf8"), f))}</script>`);

// replace the whole run of old <script src="uuid"> tags with the inlined set
const firstTag = html.search(/[ \t]*<script src="[0-9a-f-]{36}"/);
const lastTagEnd = html.lastIndexOf("</script>") + "</script>".length;
if (firstTag < 0) throw new Error("script tags not found in template");
html = html.slice(0, firstTag) + parts.join("\n  ") + html.slice(lastTagEnd);

fs.writeFileSync(OUT, html);

/* ---- 6. report --------------------------------------------------------- */
import zlib from "node:zlib";
const size = fs.statSync(OUT).size;
const gz = zlib.gzipSync(fs.readFileSync(OUT), { level: 9 }).length;
console.log(`built ${path.basename(OUT)}`);
console.log(`  ${(size / 1024 / 1024).toFixed(2)} MB raw · ${(gz / 1024).toFixed(0)} KB over the wire (gzipped)`);
