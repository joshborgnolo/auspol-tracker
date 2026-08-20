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

// Tab icon: a static echo of the wordmark dial. Single-quoted and
// percent-encoded so the markup survives being an href value.
const faviconSvg = [
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 28'>",
  "<path d='M6 24 A16 16 0 0 1 22 8' fill='none' stroke='#c4433a' stroke-width='3.2'/>",
  "<path d='M22 8 A16 16 0 0 1 38 24' fill='none' stroke='#2d5d8f' stroke-width='3.2'/>",
  "<line x1='12.9' y1='13.5' x2='10.5' y2='10.4' stroke='#c4433a' stroke-width='3.2'/>",
  "<line x1='22' y1='6' x2='22' y2='2' stroke='#e0a33c' stroke-width='3.2'/>",
  "<line x1='31.1' y1='13.5' x2='33.5' y2='10.4' stroke='#2d5d8f' stroke-width='3.2'/>",
  "<circle cx='22' cy='24' r='2.4' fill='#1d1b18'/></svg>",
].join("");
const favicon = encodeURIComponent(faviconSvg);

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
