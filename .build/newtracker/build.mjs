/* build.mjs – build index.html from source.
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
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeAtomic } from "../atomic-write.mjs";
import zlibVic from "node:zlib";
import { validate } from "./validate.mjs";
import { shellCss, shellJs, shellDrift, mainChrome } from "../site-shell.mjs";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
/* BUILD_JUR=vic builds /vic/ – the Victorian state-election page – from this
   same file, the same template and the same components, on the Victorian
   dataset (.build/vic/to-main-schema.mjs maps data/vic-polls.json onto
   data/polls.json's shape; gen-data reads its `jurisdiction`). It writes
   vic/index.html and nothing else: the federal page's side outputs (tab icon
   files, the satellites' shell assets, the share-card stamp, Past cycles'
   source rows, feed, sitemap, robots) are this build's alone. BUILD_OUT
   writes the page somewhere else (tests). */
const VIC = process.env.BUILD_JUR === "vic";
/* index.html, so a static host serves it at the site root with no config and
   no redirect. The name is the deploy contract, not a description. */
const OUT = process.env.BUILD_OUT || (VIC ? path.join(ROOT, "vic", "index.html") : path.join(ROOT, "index.html"));

/* Where this page is published. Open Graph requires og:image and og:url to be
   ABSOLUTE – a relative path is invalid per the spec and Facebook, LinkedIn,
   Slack and Discord all decline to resolve one, which is why the share card
   never appeared. Nothing else in the build needs to know the origin, so it
   lives here as one constant.
   It must match the CNAME in the repo root. GitHub Pages redirects the
   github.io address to the custom domain, and a card whose og:url pointed at
   the redirect would be shared under the old name. Change it if the site
   moves, or set SITE_URL= in the environment. */
const SITE_URL = (process.env.SITE_URL || "https://auspoltracker.com/")
  .replace(/\/*$/, "/");
const PAGE_URL = SITE_URL + (VIC ? "vic/" : "");
const A = (f) => path.join(HERE, "assets", f);
/* gen-data's two outputs: beside the components federally, in .build/vic/out
   (gitignored) for /vic/ so the two builds never overwrite each other */
const GEN_OUT = VIC ? path.join(ROOT, ".build", "vic", "out") : path.join(HERE, "assets");
const DATASET = "9f09dca2-bd46-49a8-8ae1-51847608cf92.js";
const DA = (f) => path.join(GEN_OUT, f);

/* The report-an-error form lives on /feedback/ – a hand-maintained standalone
   page carrying the Formspree endpoint itself. FORMSPREE_ID once went into the
   page here as window.AP_FEEDBACK; the move made the wiring unnecessary. */

/* ---- 1. the data must be sound before anything is built ---------------- */
const DATA = VIC
  ? (await import("../vic/to-main-schema.mjs")).vicToMain(JSON.parse(fs.readFileSync(path.join(ROOT, "data", "vic-polls.json"), "utf8")))
  : JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
if (VIC) { fs.mkdirSync(GEN_OUT, { recursive: true }); writeAtomic(DA("polls.json"), JSON.stringify(DATA, null, 2) + "\n"); }
const { errors, exempted, orphans } = validate(DATA);
if (errors.length) {
  console.error(`\n${VIC ? "data/vic-polls.json (as the main dataset)" : "data/polls.json"} – ${errors.length} problem(s), build stopped:`);
  errors.forEach((e) => console.error(`  ${e.type.padEnd(13)} ${e.poll} – ${e.detail}`));
  process.exit(1);
}
console.log(`validated ${DATA.polls.length} polls · ${exempted.length} documented exceptions · ${orphans.length} leadership-only rows`);

/* ---- 2. regenerate the derived dataset --------------------------------- */
/* Runs in-process now: the child spawn cost ~0.3s per build to save the main
   nothing. The module is import-safe (no process.exit/argv, env seams read
   on import), and `node gen-data.mjs` still runs standalone – np-backtest
   spawns it that way. Its ~40 diagnostic lines stay muted, exactly what the
   child's ignored stdout did. */
if (VIC) { process.env.GEN_DATA_POLLS = DA("polls.json"); process.env.GEN_DATA_OUT = GEN_OUT; }
const _mutelog = console.log, _mutewarn = console.warn;
console.log = console.warn = () => {};
try { await import("./gen-data.mjs"); }
finally { console.log = _mutelog; console.warn = _mutewarn; }
/* gen-data's whole job is these two files. Everything downstream of this
   line reads them by name, so if either is missing or empty the diagnosis
   belongs here, not in a readFileSync ENOENT two hundred lines later. */
for (const rel of ["9f09dca2-bd46-49a8-8ae1-51847608cf92.js", "cycle-source.json"]) {
  const exists = fs.existsSync(DA(rel));
  if (!exists || fs.statSync(DA(rel)).size === 0) {
    console.error(`\n.build/newtracker/${"assets/" + rel} is ${exists ? "empty" : "missing"} after gen-data – build stopped`);
    process.exit(1);
  }
}

/* ---- 3. source modules, in load order ---------------------------------- */
// plain scripts first (they define the window aliases every component needs)
const PLAIN = [
  "9f09dca2-bd46-49a8-8ae1-51847608cf92.js",
  "ed2260de-5b11-4bd5-8a8d-a391156c05ee.js",
  "np-project.js", // the next-polls projection (needs window.AP; the sim evals this same file)
  "copy-chart.js", // per-chart copy-as-image button
  "copy-poll.js",  // copy-as-image button for the expanded poll breakdown
];
const JSX = [
  "08b413e7-8dbe-49bf-8932-a479f8d98f54.js",  // chart toolkit
  "052e810c-b1c8-4847-a954-426d3af38e6d.jsx", // tweaks panel
  "a11e1559-f455-44d5-8a31-6699de4ef310.js",  // panels
  "d1a1d215-370c-4ebc-878b-7eeea9ad8102.js",  // tabbed views
  "wm-story.jsx",                             // the wordmark dial, replayed
  "rd.jsx",                                   // the redesign's own pieces (sections, gauges, tables)
  "rd-hero.jsx",                              // the redesign's two-party section
  "rd-panels.jsx",                            // the redesign's other Snapshot sections
  "rd-polls.jsx",                             // the redesign's latest-and-next polls table
  "rd-cycles.jsx",                            // the redesign's Past cycles tab
  "rd-allpolls.jsx",                          // the redesign's All polls tab
  "73de0c58-f11f-4793-9f90-77e583ab051b.js",  // header, hero, mount
];

const Babel = require("./vendor/babel-standalone.js");
/* Comments are for the source, not the visitor. The modules are written as
   long-form notes and shipping them verbatim cost ~170KB of the ~480KB the
   page took over the wire, gzipped. Babel reprints without them (licence
   banners kept); the plain scripts go through the same printer with no preset.
   Nothing reads a comment back out of index.html – check-site compares bytes
   against the committed build, and that is rebuilt by this same file. */
const BABEL_OUT = { compact: false, babelrc: false, configFile: false,
  shouldPrintComment: (c) => /@license|@preserve/.test(c) };
/* Both transforms are pure in (source, options, vendored Babel) – Babel's
   parse+print of the 17 modules is the build's slowest second, and between
   builds barely any of those modules change. The output is cached under a
   hash of all three inputs; a miss costs exactly what it always did, a hit
   is a read. Initialised lazily on first call so the hash helper below can
   live under it, and pruned of fortnight-old entries then. The cache dir is
   gitignored scratch – deleting it just makes the next build recompute. */
let tcInit = null;
const babelCached = (mode, code, name, extra) => {
  if (!tcInit) {
    tcInit = {
      dir: path.join(HERE, ".transpile-cache"),
      key: hash8(fs.readFileSync(path.join(HERE, "vendor", "babel-standalone.js"))),
    };
    fs.mkdirSync(tcInit.dir, { recursive: true });
    for (const old of fs.readdirSync(tcInit.dir)) {
      if (Date.now() - fs.statSync(path.join(tcInit.dir, old)).mtimeMs > 14 * 864e5)
        fs.unlinkSync(path.join(tcInit.dir, old));
    }
  }
  const opts = JSON.stringify({ ...BABEL_OUT, shouldPrintComment: String(BABEL_OUT.shouldPrintComment), ...extra });
  const src = `${mode}${opts}${tcInit.key}${code}`;
  const hit = path.join(tcInit.dir, `${hash8(Buffer.from(src, "utf8"))}.js`);
  try { return fs.readFileSync(hit, "utf8"); } catch {}
  const out = Babel.transform(code, { ...BABEL_OUT, ...extra, filename: name }).code;
  writeAtomic(hit, out);
  return out;
};
const transpile = (code, name) => babelCached("jsx", code, name, { presets: [["react", { runtime: "classic" }]] });
const stripJs = (code, name) => babelCached("plain", code, name, {});

/* An inline <script> ends at the first literal "</script", wherever it appears
   – including inside a JS string. Escaping the slash is inert in JS. */
const inlineJs = (code) => code.replace(/<\/script/gi, "<\\/script");

/* ---- 4. template ------------------------------------------------------- */
let html = fs.readFileSync(path.join(HERE, "template.html"), "utf8");

/* -- fonts: one hashed, cache-forever file per latin-subset face ------------
   These used to be base64'd into the stylesheet. woff2 is already compressed,
   so base64 added a third to each file and gzip could not win it back: the
   three faces were ~157KB of the ~490KB the page cost over the wire, they
   blocked the first paint, and they were re-downloaded on every visit because
   they had no URL of their own to be cached under.
   They are files again, named by a hash of their own bytes so a browser can
   keep them forever and still pick up a new cut the moment one ships. */
const FONTS = [
  /* The text faces are self-hosted latin subsets. Crimson Text ships as
     static cuts only (there is no variable cut), so the serif range is
     carried by one file per weight per style. */
  { file: "crimsontext-400-latin.woff2",        family: "Crimson Text", style: "normal", weight: "400", preload: true },
  { file: "crimsontext-600-latin.woff2",        family: "Crimson Text", style: "normal", weight: "600", preload: true },
  /* 700 normal is not preloaded: its only serif-context consumer is the
     leadership note's strong emphasis, below the fold on every viewport, so
     it can arrive with the page instead of queueing ahead of the hero. */
  { file: "crimsontext-700-latin.woff2",        family: "Crimson Text", style: "normal", weight: "700" },
  { file: "crimsontext-italic-400-latin.woff2", family: "Crimson Text", style: "italic", weight: "400" },
  { file: "crimsontext-italic-600-latin.woff2", family: "Crimson Text", style: "italic", weight: "600" },
  { file: "crimsontext-italic-700-latin.woff2", family: "Crimson Text", style: "italic", weight: "700" },
  /* Source Serif 4 retired Sep 2026: the tab labels and docked score set in
     Crimson Text, the page's one serif. The source subset stays in fonts/. */
  { file: "ibmplexsans-latin.woff2",            family: "IBM Plex Sans", style: "normal", weight: "300 700", preload: true },
  /* Source Sans 3 has one caller: the .wordmark lockup. It paints the first
     screen, but the stack falls back to system sans in the moment before it
     lands, which is cheaper than a preload. */
  { file: "sourcesans3-latin.woff2",            family: "Source Sans 3", style: "normal", weight: "400 800" },
  /* Archivo is retired: the expanded poll breakdown was its only consumer and
     that panel is now set in Source Sans 3 throughout. The source subset stays
     in fonts/ so re-registering it is a one-line change. */
];
const FONT_DIR = path.join(ROOT, "assets", "fonts");
fs.mkdirSync(FONT_DIR, { recursive: true });
const hash8 = (buf) => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
const fontKeep = new Set();
const fontLinks = [];
const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const faceCss = FONTS.map((f) => {
  const buf = fs.readFileSync(path.join(HERE, "fonts", f.file));
  const name = f.file.replace(/\.woff2$/, `.${hash8(buf)}.woff2`);
  fontKeep.add(name);
  writeAtomic(path.join(FONT_DIR, name), buf);
  const href = `assets/fonts/${name}`;
  /* Only the faces that paint text on the way in are preloaded. The italic
     serif sets a handful of small labels, and Source Sans 3 waits for the
     expanded breakdown, so both can arrive with the rest of the page rather
     than competing with it for the first connections. */
  if (f.preload) fontLinks.push(`<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`);
  return `@font-face {
  font-family: '${f.family}';
  font-style: ${f.style};
  font-weight: ${f.weight};
  font-display: swap;
  src: url("${href}") format('woff2');
  unicode-range: ${LATIN};
}`;
}).join("\n");
// a hashed name changes when the bytes do, so sweep the ones nothing points at
for (const old of fs.readdirSync(FONT_DIR)) {
  if (/\.woff2$/.test(old) && !fontKeep.has(old)) fs.unlinkSync(path.join(FONT_DIR, old));
}

/* Splice the generated faces in at an explicit marker, like the static
   summary and the scripts below. The old splice found the first @font-face
   (a decoy "splice-anchor" rule the template carried for exactly this) and
   cut to the last } before the next </style> – correct, but only while the
   template kept that block's shape in lockstep with this arithmetic.
   Function replacer: face css could carry $-patterns for the string form. */
if (!html.includes("/*FONTFACES*/")) throw new Error("FONTFACES marker not found in template");
html = html.replace("/*FONTFACES*/", () => faceCss);

/* The redesign's stylesheet, kept in its own file beside the components that
   use it. Every rule in it is scoped to body.rd, so the design it replaced
   (the tagline's "last" switches between them) renders exactly as before. */
if (!html.includes("/*RDCSS*/")) throw new Error("RDCSS marker not found in template");
html = html.replace("/*RDCSS*/", () => fs.readFileSync(A("rd.css"), "utf8"));

/* The body-start script dresses the page in App's theme classes before its
   first style, so it needs App's defaults - read from App's own EDITMODE
   block (the tweaks host rewrites that literal), never copied by hand. */
const editMode = fs.readFileSync(A("73de0c58-f11f-4793-9f90-77e583ab051b.js"), "utf8")
  .match(/\/\*EDITMODE-BEGIN\*\/([\s\S]*?)\/\*EDITMODE-END\*\//);
if (!editMode) throw new Error("EDITMODE defaults not found in the app module");
if (!html.includes("/*TWEAK_DEFAULTS*/{}")) throw new Error("TWEAK_DEFAULTS marker not found in template");
html = html.replace("/*TWEAK_DEFAULTS*/{}", () => JSON.stringify(JSON.parse(editMode[1])));

// -- head: give the page a tab icon + a share card --

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
function oklchRgb(L, C, Hdeg) {
  const h = (Hdeg * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, sp = s_ ** 3;
  const lin = [ 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * sp,
               -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * sp,
               -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * sp];
  return lin.map((c) => {
    c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(1, c)) * 255;
  });
}
const rgbHex = (a) => "#" + a.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
function oklchHex(L, C, Hdeg) { return rgbHex(oklchRgb(L, C, Hdeg)); }

/* ---- theme-color: what iOS paints BEHIND the status bar -----------------
   That strip is Safari's own chrome, not the page: no CSS reaches it, and it
   cannot be made translucent outside standalone mode. All the page controls is
   its TINT, via this meta - so the least jarring thing it can be is the colour
   of whatever it sits directly above, which on a scrolled page is the pinned
   tab bar.

   These were hand-picked before and had drifted badly: #f6f1e7 against a bar
   that renders #fbf9f5, and #14110d against #231e1a - a visible step in light
   and a worse one in dark. Derived now, the same way PARTY_HEX above is, so a
   palette change carries through instead of leaving this behind.

   The bar is opaque --bg (it was briefly frosted; a frosted bar under a flat
   status band read as a seam, so it went back to opaque - see template.html).
   So the strip, the bar and the page can all be one value.

   These are the EDITORIAL --bg values, from `body.editorial` / `body.dark
   .editorial`, not the ones on :root. Editorial is the default layout, so
   :root's pair only ever applies once someone switches to panelled - deriving
   from them put the status bar 2/255 off the page it sits above, which is the
   whole failure this meta is here to avoid. A static meta cannot follow a
   runtime toggle, so panelled keeps that 2/255; it is imperceptible, and the
   default is the one worth being exact about. */
const THEME = { light: [0.975, 0.009, 80], dark: [0.205, 0.010, 65] };
const THEME_LIGHT = oklchHex(...THEME.light), THEME_DARK = oklchHex(...THEME.dark);
const PARTY_HEX = {
  alp: oklchHex(0.55, 0.150, 27), lnp: oklchHex(0.50, 0.095, 250),
  grn: oklchHex(0.60, 0.120, 150), onp: oklchHex(0.66, 0.130, 58),
};

function buildFavicon() {
  // pull the derived series straight out of the asset gen-data just wrote
  const src = fs.readFileSync(DA(DATASET), "utf8");
  const grab = (name) => {
    const i = src.indexOf("const " + name + " = ");
    if (i < 0) throw new Error("favicon: " + name + " not found in dataset");
    return JSON.parse(src.slice(i + name.length + 9, src.indexOf("\n", i)).replace(/;$/, ""));
  };
  const L = grab("latest"), S = grab("synthLatest"), alt = grab("altLatest");

  // --- graduations: latest primary aggregate, tallest first (as on the page) ---
  const lp = L.primary;
  const glyph = ["alp", "lnp", "grn", "onp"].map((id) => ({ id, v: lp[id] }))
    .sort((a, b) => b.v - a.v);
  const vs = glyph.map((p) => p.v), gmin = Math.min(...vs), gmax = Math.max(...vs);
  const MIN_H = 5, MAX_H = 10.5;
  glyph.forEach((p) => { p.h = gmax === gmin ? MAX_H : MIN_H + ((p.v - gmin) / (gmax - gmin)) * (MAX_H - MIN_H); });

  /* --- needle: 2PP against Labor's rival, AS THE MASTHEAD RULES IT ---
     The rival is gen-data's rivalLead - the deadband walk over the implied
     series that decides which contest the hero leads with - and the margin
     is read on the same basis the hero prints: implied (synthLatest / onImp)
     where it exists, the published pair otherwise. This used to pick
     whichever challenger had the larger PUBLISHED 2PP share, with no
     deadband: on 2026-09-21 that still said Coalition (48.0 v 46.4) while
     the page, on the implied basis, had already moved to One Nation, so the
     tab icon argued with the masthead beside it. */
  const rival = L.rivalLead === "alp_on" && (L.onImp?.a != null || alt?.alp_on?.a != null) ? "onp" : "lnp";
  const top = rival === "onp"
    ? (L.onImp?.a != null ? { id: "onp", lab: L.onImp.a, opp: L.onImp.b } : { id: "onp", lab: alt.alp_on.a, opp: alt.alp_on.b })
    : (S && S.alp != null ? { id: "lnp", lab: S.alp, opp: S.lnp } : { id: "lnp", lab: L.alp2pp, opp: L.lnp2pp });
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
  /* --- the same instrument again at masthead weight, for the satellites ---
     /assets/masthead-dial.svg is the no-JS stand-in their lockup shows; the
     spec below (written into auspol-now.json) is what site-shell.js draws
     their live inline dial from – strokes as var()s off the same geometry,
     so a satellite's glyph IS the masthead's, not a copy of it. */
  const SETTLE_H = (MIN_H + MAX_H) / 2;
  const mBars = glyph.map((p, i) => {
    const a = BAR_ANGLES[i], s = polar(a, GC.r + 2), e = polar(a, GC.r + 2 + MAX_H);
    return { id: p.id, x1: s.x, y1: s.y, x2: e.x, y2: e.y, h: +p.h.toFixed(2) };
  });
  const mArcL = arc(-90, 0), mArcR = arc(0, 90);
  const leader = margin >= 0 ? "alp" : top.id;
  const mastheadSpec = { vp: "0.58 0.07 38.39 26.73", cx: GC.cx, cy: GC.cy,
                         arcL: mArcL, arcR: mArcR, right: top.id, leader,
                         settle: SETTLE_H, max: MAX_H, nd: +needleDeg.toFixed(2), bars: mBars };
  const INK3 = oklchHex(0.52, 0.010, 58);
  const mastheadSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${mastheadSpec.vp}'>`
    + `<path d='${mArcL}' fill='none' stroke='${PARTY_HEX.alp}' stroke-width='1.4' opacity='0.5'/>`
    + `<path d='${mArcR}' fill='none' stroke='${PARTY_HEX[top.id]}' stroke-width='1.4' opacity='0.5'/>`
    + mBars.map((b) => `<line x1='${b.x1}' y1='${b.y1}' x2='${b.x2}' y2='${b.y2}' stroke='${PARTY_HEX[b.id]}' stroke-width='3.4' stroke-linecap='butt' stroke-dasharray='${b.h} ${MAX_H}'/>`).join("")
    + `<g transform='translate(${GC.cx}, ${GC.cy})'><g transform='rotate(${mastheadSpec.nd})'>`
    + `<line x1='0' y1='0' x2='0' y2='-8.6' stroke='${PARTY_HEX[leader]}' stroke-width='1.7' stroke-linecap='round'/>`
    + `<circle cx='0' cy='-8.6' r='1.9' fill='${PARTY_HEX[leader]}'/></g></g>`
    + `<circle cx='${GC.cx}' cy='${GC.cy}' r='1.7' fill='${INK3}'/></svg>`;

  return { svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}'>${parts.join("")}</svg>`,
           note: `${glyph.map((p) => p.id + " " + p.v.toFixed(1)).join(", ")} · needle ${needleDeg.toFixed(1)}deg vs ${top.id}`,
           masthead: { spec: mastheadSpec, svg: mastheadSvg },
           // the dial's contest and figures: the satellites' header docks the same pair
           score: { rival: top.id, a: +top.lab.toFixed(1), b: +top.opp.toFixed(1), basis: (rival === "onp" ? L.onImp?.a != null : S && S.alp != null) ? "imp" : "resp" } };
}

/* Pull the derived headline straight out of the dataset gen-data just wrote,
   so the card's stamp check and its alt text quote the same numbers the page
   does rather than a second, drifting copy. The headline basis is IMPLIED
   (synthLatest) where it exists - the pollsters' own respondent-allocated
   figures ride along in .pub for the static article's own pair (its ss-lead
   states both, labelled). */
const headlineView = (L, S) => (S && S.alp != null)
  ? { ...L,
      alp2pp: S.alp, lnp2pp: S.lnp, alp2ppCi95: S.ci95, alp2ppNEff: S.nEff,
      alp2ppPrev: S.prev != null ? S.prev : L.alp2ppPrev, changeSig: S.changeSig,
      method: { ...L.method, nPolls: S.n },
      basis: "imp",
      pub: { alp2pp: L.alp2pp, lnp2pp: L.lnp2pp, alp2ppCi95: L.alp2ppCi95 } }
  : { ...L, basis: "pub",
      pub: { alp2pp: L.alp2pp, lnp2pp: L.lnp2pp, alp2ppCi95: L.alp2ppCi95 } };

function grabLatest() {
  const src = fs.readFileSync(DA(DATASET), "utf8");
  const grab = (name) => {
    const i = src.indexOf("const " + name + " = ");
    if (i < 0) throw new Error(name + " not found in dataset");
    return JSON.parse(src.slice(i + name.length + 9, src.indexOf("\n", i)).replace(/;$/, ""));
  };
  return headlineView(grab("latest"), grab("synthLatest"));
}

/* One short race sentence, shared by the static summary's sub-head and the
   meta / og descriptions, so the SERP snippet, social previews and the
   crawled page text can never disagree. */
const raceLine = (v) => {
  const d = +(v.alp2pp - v.lnp2pp).toFixed(1);
  return d > 0 ? `Labor leads the Coalition ${v.alp2pp}\u2013${v.lnp2pp}`
       : d < 0 ? `The Coalition leads Labor ${v.lnp2pp}\u2013${v.alp2pp}`
       : `Neither side leads: ${v.alp2pp}\u2013${v.lnp2pp}`;
};

/* The clause that follows the race line wherever the figure lands: implied
   is the default basis, and a figure that isn't what a pollster filed must
   say so in the same breath. The full explanation lives in the Two-party
   preferred section; this is the tag the figure itself carries. */
const basisClause = (v) => v.basis === "imp" ? " on implied preference flows" : "";

/* "Set against the last N" in the tagline / meta copy is the count of PAST
   federal terms the tracker has cycles for, derived from the cycle-source
   rows (one key per past term; the Now term is never among them) so a new
   Past-cycles term renumbers the sentence on its own. Spelled out to twenty
   – at ~3-yearly elections the digit fallback is decades away. */
const CYCLE_COUNT_WORDS = ["zero","one","two","three","four","five","six","seven","eight","nine","ten",
                           "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen",
                           "eighteen","nineteen","twenty"];
/* Called from the tagline, the meta description and the summary table –
   ~240KB of JSON parsed once, not per call. cycle-source.json is gen-data's
   last word for the whole build, so the count cannot move mid-run. */
let pastCycleN = null;
function pastCycleWord() {
  if (pastCycleN == null) pastCycleN = Object.keys(JSON.parse(fs.readFileSync(DA("cycle-source.json"), "utf8"))).length;
  return CYCLE_COUNT_WORDS[pastCycleN] || String(pastCycleN);
}

const fav = buildFavicon();
console.log("  favicon:", fav.note);
console.log(`  theme-color: ${THEME_LIGHT} light · ${THEME_DARK} dark (matches --bg / the pinned bar)`);
/* The satellite pages (/archives/*, /prediction/) link this file as their tab
   icon instead of carrying their own copies, so every page shows the
   masthead's current glyph. Stable unhashed name - the satellites' <link> is
   the point; a content hash would orphan them. */
if (!VIC) writeAtomic(path.join(ROOT, "assets", "favicon.svg"), fav.svg + "\n");
/* The satellites' lockup glyph: the masthead dial itself at its own weight,
   as a static stand-in for before JS draws the live one (the spec rides
   auspol-now.json just below). Same unhashed-name contract as the favicon. */
if (!VIC) writeAtomic(path.join(ROOT, "assets", "masthead-dial.svg"), fav.masthead.svg + "\n");

/* The shared chrome of the pages outside this build (.build/site-shell.mjs):
   its stylesheet and script, the live figure its header docks, the dial the
   lockup draws, and the tide band's two drawings, as files beside the
   favicon – under assets/, which every updater commits, so the satellites
   follow each build without being rewritten (a page the build rewrote would
   leave the tree dirty: the updaters' commit lists name no satellite). The
   figure is the favicon dial's own contest and basis, which are the main
   page's. The band's drawings are lifted out of this template's --tile-art
   data URIs, so the satellites close on exactly the main page's tide. */
if (!VIC) {   // the satellites' shell follows the FEDERAL page (closed below)
writeAtomic(path.join(ROOT, "assets", "site-shell.css"), shellCss());
writeAtomic(path.join(ROOT, "assets", "site-shell.js"), shellJs());
/* …and what the satellites' masthead and tab bar show beside it, off the same
   dataset the main page's do: the status block's three facts and the phone
   compact (the newest poll by its pollster and fieldwork, linked to its
   release – the main page's rdLatest), the tagline's count of past terms,
   and the houses' release rhythm the bar's next-poll countdown projects
   from at view time (np-project.js, run by site-shell.js), so the countdown
   stays right as a page ages between builds. */
const shellNow = (() => {
  const src = fs.readFileSync(DA(DATASET), "utf8");
  const grab = (name) => {
    const i = src.indexOf("const " + name + " = ");
    if (i < 0) throw new Error("site shell: " + name + " not found in dataset");
    return JSON.parse(src.slice(i + name.length + 9, src.indexOf("\n", i)).replace(/;$/, ""));
  };
  const L = grab("latest");
  /* the newest row of pollsterTable, exactly as the main page's Header
     picks it (pubSort desc) – releaseUrl over a media url citation is the
     archive emitter's own precedence */
  const newest = grab("pollsterTable").slice().sort((a, b) => (a.pubSort < b.pubSort ? 1 : -1))[0] || null;
  return { latest: { published: L.published, publishedISO: L.publishedISO, nextElectionDue: L.nextElectionDue,
                     pollsTracked: L.pollsTracked, housesTracked: L.housesTracked,
                     fact: newest ? newest.pollster + ", " + newest.field : null,
                     factUrl: newest ? (newest.releaseUrl || newest.url || null) : null },
           past: pastCycleWord(), pollCadence: grab("pollCadence") };
})();
/* The masthead's words and artwork as the main page renders them, lifted by
   site-shell.mjs's mainChrome() into the `copy` block: site-shell.js swaps
   it over the baked header at view time, so a rename on the main page lands
   on every satellite with this build, no page commit. A parse miss is a
   warning like the tile-art miss below (never a poll-data block) – the JSON
   keeps the previous build's copy block, which stays closer than nothing. */
let shellChrome = null;
try { shellChrome = mainChrome(); }
catch (e) {
  console.warn(`  site shell: chrome parse missed (${e.message}) – auspol-now.json keeps the previous copy block`);
  try { shellChrome = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "auspol-now.json"), "utf8")).copy || null; } catch {}
}
writeAtomic(path.join(ROOT, "assets", "auspol-now.json"), JSON.stringify({ ...fav.score, dial: fav.masthead.spec, ...shellNow, ...(shellChrome ? { copy: shellChrome } : {}) }) + "\n");
for (const [token, file] of [["--tile-art", "tile-art.svg"], ["--tile-art-dark", "tile-art-dark.svg"]]) {
  const m = html.match(new RegExp(token + ':\\s*url\\("data:image\\/svg\\+xml,([^"]+)"\\)'));
  if (m) writeAtomic(path.join(ROOT, "assets", file), decodeURIComponent(m[1]) + "\n");
  else console.warn(`  site shell: ${token} not found in the template – the satellites' tide band keeps its last drawing`);
}
/* A satellite whose shell is out of step – the header or footer markup
   changed here, or a page was edited by hand around it – is a warning, not
   a failure: the page still works, and the fix is one command a person
   commits (the build must not rewrite satellites itself, see above). */
{
  const drift = shellDrift();
  if (drift.length) console.warn(`  site shell out of step on ${drift.join(", ")} – run node .build/site-shell.mjs and commit the pages`);
}
}   // !VIC – the satellites' shell
const favicon = encodeURIComponent(fav.svg);

/* The raster copy Google Search needs, rasterised by render-favicon.mjs and
   committed like the share card is. Googlebot-Image has to be able to CRAWL a
   favicon, so the data URI below is invisible to it - and the SVG written just
   above would not help either, since Google's supported formats are BMP, GIF,
   ICO, PNG, JPEG, PPM and TIFF. That is why the result page showed a globe.
   Linked only when it is actually on disk: a <link> pointing at a 404 is
   worse than no link, and a fresh clone that has never run the rasteriser
   should still build. */
const FAV_PNG = path.join(ROOT, "assets", "favicon-192.png");
const FAV_STAMP = path.join(ROOT, "assets", "favicon-192.json");
/* The stamp check. Every build rewrites favicon.svg, so mtime is no signal -
   content-hash the SVG and compare against the stamp the rasteriser leaves in
   assets/favicon-192.json. Hash exactly what the renderer hashes: the FILE on
   disk, newline included, not the in-memory fav.svg. */
const FAV_SVG_SHA = crypto.createHash("sha256").update(fav.svg + "\n").digest("hex");
const favPngState = () => {
  if (!fs.existsSync(FAV_PNG)) return "absent";
  try {
    return JSON.parse(fs.readFileSync(FAV_STAMP, "utf8")).svgSha256 === FAV_SVG_SHA ? null : "stale";
  } catch (_) { return "stale"; }
};
/* A glyph that moved re-rasterises here and now: render-favicon.mjs gates
   itself on this same stamp, so the spawn only ever runs when a draw is owed,
   and refresh_site's own render call after the build is then the no-op one.
   Best-effort - the renderer wants Chrome + puppeteer-core and a machine
   without either still builds; it keeps the old raster and the reminder
   below. Warn, never fail: a wrapper mid-refresh_site is already consistent
   by the time the commit goes out. */
const favWas = VIC ? null : favPngState();
if (favWas) {
  try { execFileSync(process.execPath, [path.join(HERE, "render-favicon.mjs")], { cwd: ROOT, stdio: "ignore" }); }
  catch (_) { /* no Chrome, no puppeteer-core - the report below says what's left */ }
}
const favPng = !VIC && fs.existsSync(FAV_PNG);
const favNow = favPngState();
if (favWas && !favNow) console.log("  favicon PNG: re-rasterised for the current glyph");
if (favNow === "absent") console.log("  favicon PNG: absent – run render-favicon.mjs (Google Search shows no icon without it)");
if (favNow === "stale") console.log("  favicon PNG: drawn from an older glyph – run render-favicon.mjs to re-rasterise");

/* ---- 4b. the article version of the page ---------------------------------
   #root held a loading placeholder that was `opacity: 0` with a .25s delay
   while React mounted in ~160ms – so it was never actually seen – and the
   whole document carried 499 bytes of markup. That left nothing for a crawler,
   a link-preview scraper, reader mode, or a reader whose JS failed.

   This emits the editorial equivalent of the whole page – headline figures,
   latest polls, the full methodology and sources – as one semantic <article>.
   It lives OUTSIDE #root, so createRoot() cannot clear it; once the app
   mounts body.js makes it transparent (see the rule near .wm-sr in the
   template) and it stays in the DOM as the text assistive tech reads and
   the article reader engines (Safari Reader, Firefox Reader View – both
   judge the POST-script DOM, and both skip display:none content) extract.
   Derived from the same generated dataset as everything else, so it cannot
   drift from the charts. */
function buildStaticSummary() {
  const src = fs.readFileSync(DA(DATASET), "utf8");
  const grab = (name) => {
    const i = src.indexOf("const " + name + " = ");
    if (i < 0) throw new Error("static summary: " + name + " not found");
    return JSON.parse(src.slice(i + name.length + 9, src.indexOf("\n", i)).replace(/;$/, ""));
  };
  const L = headlineView(grab("latest"), grab("synthLatest")), prim = L.primary;
  /* federal-only caller (VIC has its own summary), so DATA is polls.json
     already parsed up top – no second read */
  const EL25 = DATA.elections.e2025;
  const table = grab("pollsterTable"), acc = grab("accuracy");
  const polls = grab("individualPolls");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const lead = (L.alp2pp - L.lnp2pp).toFixed(1);
  const who = L.alp2pp >= L.lnp2pp ? "Labor" : "the Coalition";
  const PARTY = { alp: "Labor", lnp: "Coalition", grn: "Greens", onp: "One Nation", oth: "Others" };

  const rows = table.slice(0, 6).map((r) => `
        <tr>
          <th scope="row">${esc(r.pollster)}</th>
          <td>${esc(r.field)}</td>
          <td>${r.sample ? r.sample.toLocaleString("en-AU") : "&#8211;"}</td>
          <td>${r.alpImp != null ? r.alpImp.toFixed(1) + "%" : "&#8211;"}</td>
          <td>${r.alpImp != null ? (100 - r.alpImp).toFixed(1) + "%" : "&#8211;"}</td>
        </tr>`).join("");

  /* A table, not a flex list: reader engines honour table columns but drop
     flexbox, which left one space between the party and its share. */
  const primary = ["alp", "lnp", "grn", "onp", "oth"]
    .filter((k) => prim[k] != null)
    .map((k) => `<tr><th scope="row">${PARTY[k]}</th><td>${EL25[k].toFixed(1)}%</td><td>${prim[k].toFixed(1)}%</td></tr>`).join("\n          ");

  /* Same pollster list as MethodNote: straight from the archive, busiest
     first. It is part of the sourcing, not a footer to drop. */
  const counts = {};
  polls.forEach((p) => { counts[p.pollster] = (counts[p.pollster] || 0) + 1; });
  const sources = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).join(", ");

  return `<article class="static-summary">
      <h1>auspol tracker</h1>
      <p class="ss-sub">Aggregated opinion polling for the next Australian federal election, set against the last ${pastCycleWord()}.
        ${raceLine(L)} two-party preferred${basisClause(L)} (&#177;${L.alp2ppCi95}) &#8211; updated <time datetime="${esc(L.updatedISO)}">${esc(L.updated)}</time> from
        ${L.pollsTracked} published polls across ${L.housesTracked} polling houses. Next election due ${esc(L.nextElectionDue[0].toLowerCase() + L.nextElectionDue.slice(1))}.</p>

      <h2>Two-party preferred</h2>
      <p class="ss-lead"><b>Labor ${L.alp2pp.toFixed(1)}%</b>, <b>Coalition ${L.lnp2pp.toFixed(1)}%</b>${L.basis === "imp" ? `
        on implied preference flows &#8212; the pollsters&#8217; own respondent-allocated
        figures read <b>Labor ${L.pub.alp2pp.toFixed(1)}%</b>, <b>Coalition ${L.pub.lnp2pp.toFixed(1)}%</b>` : ""}</p>
      <p>${who} leads by ${Math.abs(lead).toFixed(1)} points
        (&#177;${(2 * L.alp2ppCi95).toFixed(1)} on the lead)${L.basis === "imp" ? `
        on implied preference flows &#8211; every poll&#8217;s primary votes
        re-allocated by the preference flows the AEC counted at the 2025 election,
        so every poll that publishes primaries counts, not only those that file a
        two-party figure. The pollsters&#8217; own respondent-allocated figures
        aggregate to ${L.pub.alp2pp.toFixed(1)}&#8211;${L.pub.lnp2pp.toFixed(1)}, and
        the live chart switches between the two` : ""}. The aggregate is a sample- and
        recency-weighted,
        house-effect-adjusted mean over a ${L.method.windowDays}-day window
        (${L.method.halfLifeDays}-day half-life), carrying a 95% interval of
        &#177;${L.alp2ppCi95.toFixed(1)} points on each share from ${L.method.nPolls} polls. Repeat waves from
        one house inside a window or a calendar month count for the square root of their number,
        so three weekly waves count as 1.7, not 3.</p>

      ${/* The ALP v ON implied nowcast (latest.onImp, null when thin) – the
           second contest the page headlines, so the article carries it too.
           Its ± stacks the flow table's own ranges, not sampling error, and
           its basis is the first-principles set, not the 2025 flows – the
           sentence has to say both, since the classic pair above is. */
      L.onImp ? `<p>Against One Nation the implied reading is
        <b>Labor ${L.onImp.a.toFixed(1)}%</b>, <b>One Nation ${L.onImp.b.toFixed(1)}%</b>
        (&#177;${L.onImp.band.toFixed(1)} on the flow table, not the sample). No election
        night has ever counted a Labor v One Nation finish, so that figure runs on the
        site&#8217;s own first-principles preference set rather than the 2025
        election&#8217;s flows; the pollsters&#8217; few printed head-to-heads sit beside
        it on the live chart.</p>` : ""}

      <h2>Primary vote</h2>
      <table class="ss-primary">
        <thead>
          <tr><th scope="col">Party</th><th scope="col">2025 election</th><th scope="col">Now</th></tr>
        </thead>
        <tbody>
          ${primary}
        </tbody>
      </table>

      <h2>Latest polls</h2>
      <p class="ss-cap" id="ss-polls-cap">Most recent published national polls &#8211; the two-party
        figures read each poll&#8217;s primaries at the 2025 election&#8217;s preference flows, so the
        table compares house to house on one fixed allocation; each wave&#8217;s own respondent-allocated
        figure sits in its breakdown on the archive.</p>
      <div class="ss-tblwrap">
      <table class="ss-table" aria-labelledby="ss-polls-cap">
        <thead><tr><th scope="col">Pollster</th><th scope="col">Fieldwork</th><th scope="col">Sample</th><th scope="col">ALP 2PP</th><th scope="col">L/NP 2PP</th></tr></thead>
        <tbody>${rows}
        </tbody>
      </table>
      </div>

      <h2>About this tracker</h2>
      <p>auspol tracker pools every published national voting-intention poll since the May 2025 federal
        election. The two-party and primary-vote aggregates are weighted means: recent and larger
        polls count for more, and each pollster&#8217;s figure is adjusted for its own lean against
        the consensus of the houses polling around it &#8211; pooled with a 90-day half-life, so a
        house&#8217;s lean tracks its current method rather than averaging its whole history &#8211;
        and shrunk toward zero while the evidence is thin. The lean is measured separately for every measure &#8211; a firm
        that leans one way on the classic two-party is not assumed to lean the same way on a primary
        share or an ALP-v-One Nation head-to-head &#8211; and a matchup too few houses ask is left as
        a plain monthly average rather than adjusted on guesswork. The leaders&#8217; ratings and
        national direction run through the same monthly weighting and adjustment; preferred prime
        minister and the undecided share stay as plain averages, the differences there being a
        matter of question wording rather than lean. Houses that publish no two-party
        figure feed the primary-vote and leadership series only. Each poll&#8217;s weight rests on
        its published effective sample where the house publishes one &#8211; Newspoll, YouGov, Essential,
        DemosAU, RedBridge/Accent, and Fox &amp; Hedgehog do, in their Australian Polling Council
        methodology statements &#8211; and otherwise on its raw sample, discounted by 1.6 for
        weighting and capped at 3,000.</p>
      <p>The headline carries a 95% interval &#8211; the greater of the spread among polls in the
        window and their sampling error &#8211; currently about &#177;${L.alp2ppCi95.toFixed(1)} points
        on ${L.method.nPolls} polls across ${L.method.windowDays} days (effective sample
        ${L.alp2ppNEff} after weighting). It cannot cover error the whole industry shares: an
        aggregate has no way to see a lean every poll in it carries. Movement smaller than the
        interval is marked as such.</p>${acc ? `
      <p>That caveat is not idle. Across the ${acc.cycles.length} elections from
        ${acc.cycles[0].year} to ${acc.cycles[acc.cycles.length - 1].year} the final polls missed
        the two-party result by ${acc.meanAbs} points on average &#8211; at ${acc.worstCycle.year} by
        ${Math.abs(acc.worstCycle.err)}, every house on the same side of it.
        Past cycles carries the full record, house by house.</p>` : ""}

      <h2>Reading the charts</h2>
      <p>On the two-party chart each dot by default is one poll&#8217;s implied figure &#8211;
        its primaries re-allocated at the 2025 election&#8217;s counted flows &#8211; and the
        switch under the heading swaps the whole series to the pollsters&#8217; own published
        figures, dots and all. Elsewhere each dot is one published poll. The lines are monthly
        aggregates, shaded with the 95%
        interval around them. Where the two bands meet, that month&#8217;s lead is inside its own
        margin of error. Leadership questions are asked irregularly, so those lines are monthly
        aggregates too &#8211; adjusted per house for approval and favourability, joined straight
        from published readings for preferred prime minister. A &#8220;&#8212;&#8221; in any
        table means the pollster didn&#8217;t ask that question.</p>
      <p><strong>Why there is no seat projection here.</strong> Turning a national two-party
        figure into a seat count assumes a uniform swing, and with One Nation near
        ${Math.round(prim.onp)}% of the primary vote the assumption fails in exactly the seats that
        would decide the election: a large minor party wins seats where its vote is concentrated and
        none where it is not &#8211; and no national number knows the difference. Seat figures appear
        on this page only where a pollster modelled them seat by seat and published the result, which
        is what the MRP tag in the archive marks.</p>

      <h2>Sources</h2>
      <p>${esc(sources)}. Field dates and sample sizes are listed per poll in the archive.</p>

      <p class="ss-note" data-nosnippet>auspol tracker is an unofficial aggregator of published federal opinion polling.
        Best efforts are made to make the aggregate figures transparent, trustworthy, statistically
        sound, and informative, but they are, in the end, estimates only. Federal polling archives
        I&#8217;ve located are stored <a href="https://auspoltracker.com/archives/newspoll/">here</a> for
        safekeeping and convenience.</p>
    </article>`;
}

/* The same article for /vic/, in the Victorian page's terms: its baseline is
   the 2022 state election, its flows the 2022 Victorian ones, and it has no
   past cycles or accuracy record yet. */
function buildStaticSummaryVic() {
  const src = fs.readFileSync(DA(DATASET), "utf8");
  const grab = (name) => {
    const i = src.indexOf("const " + name + " = ");
    if (i < 0) throw new Error("static summary: " + name + " not found");
    return JSON.parse(src.slice(i + name.length + 9, src.indexOf("\n", i)).replace(/;$/, ""));
  };
  const L = headlineView(grab("latest"), grab("synthLatest")), prim = L.primary;
  const J = DATA.jurisdiction, E = DATA.elections[J.baseline], eYear = E.date.slice(0, 4);
  const table = grab("pollsterTable"), polls = grab("individualPolls");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const lead = (L.alp2pp - L.lnp2pp).toFixed(1);
  const who = L.alp2pp >= L.lnp2pp ? "Labor" : "the Coalition";
  const PARTY = { alp: "Labor", lnp: "Coalition", grn: "Greens", onp: "One Nation", oth: "Others" };
  const rows = table.slice(0, 6).map((r) => `
        <tr>
          <th scope="row">${esc(r.pollster)}</th>
          <td>${esc(r.field)}</td>
          <td>${r.sample ? r.sample.toLocaleString("en-AU") : "&#8211;"}</td>
          <td>${r.alpImp != null ? r.alpImp.toFixed(1) + "%" : "&#8211;"}</td>
          <td>${r.alpImp != null ? (100 - r.alpImp).toFixed(1) + "%" : "&#8211;"}</td>
        </tr>`).join("");
  const primary = ["alp", "lnp", "grn", "onp", "oth"]
    .filter((k) => prim[k] != null)
    .map((k) => `<tr><th scope="row">${PARTY[k]}</th><td>${E[k].toFixed(1)}%</td><td>${prim[k].toFixed(1)}%</td></tr>`).join("\n          ");
  const counts = {};
  polls.forEach((p) => { counts[p.pollster] = (counts[p.pollster] || 0) + 1; });
  const sources = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).join(", ");
  return `<article class="static-summary">
      <h1>${esc(J.brand)} tracker</h1>
      <p class="ss-sub">Aggregated opinion polling for the next ${esc(J.electionWords)} election.
        ${raceLine(L)} two-party preferred${basisClause(L)} (&#177;${L.alp2ppCi95}) &#8211; updated <time datetime="${esc(L.updatedISO)}">${esc(L.updated)}</time> from
        ${L.pollsTracked} published polls across ${L.housesTracked} polling houses. Election day: ${esc(L.nextElectionDue)}.</p>

      <h2>Two-party preferred</h2>
      <p class="ss-lead"><b>Labor ${L.alp2pp.toFixed(1)}%</b>, <b>Coalition ${L.lnp2pp.toFixed(1)}%</b>${L.basis === "imp" ? `
        on implied preference flows &#8212; the pollsters&#8217; own published
        figures read <b>Labor ${L.pub.alp2pp.toFixed(1)}%</b>, <b>Coalition ${L.pub.lnp2pp.toFixed(1)}%</b>` : ""}</p>
      <p>${who} leads by ${Math.abs(lead).toFixed(1)} points
        (&#177;${(2 * L.alp2ppCi95).toFixed(1)} on the lead)${L.basis === "imp" ? `
        on implied preference flows &#8211; every poll&#8217;s primary votes re-allocated by
        ${esc(J.flowsLabel)}, so every poll that publishes primaries counts, not only those that
        file a two-party figure` : ""}. ${L.method.kind === "kalman"
          ? `The figure is a smoothed trend (a Kalman smoother) through every poll this term,
        each counted by its sample and adjusted for its pollster&#8217;s lean, carrying a 95% interval
        of &#177;${L.alp2ppCi95.toFixed(1)} points on each share.`
          : `The aggregate is a sample- and recency-weighted,
        house-effect-adjusted mean over a ${L.method.windowDays}-day window
        (${L.method.halfLifeDays}-day half-life), carrying a 95% interval of
        &#177;${L.alp2ppCi95.toFixed(1)} points on each share from ${L.method.nPolls} polls.`}</p>

      <h2>Primary vote</h2>
      <table class="ss-primary">
        <thead>
          <tr><th scope="col">Party</th><th scope="col">${eYear} election</th><th scope="col">Now</th></tr>
        </thead>
        <tbody>
          ${primary}
        </tbody>
      </table>

      <h2>Latest polls</h2>
      <p class="ss-cap" id="ss-polls-cap">Most recent published ${esc(J.adj)} polls &#8211; the two-party
        figures read each poll&#8217;s primaries at the same preference flows, so the table compares
        house to house on one fixed allocation.</p>
      <div class="ss-tblwrap">
      <table class="ss-table" aria-labelledby="ss-polls-cap">
        <thead><tr><th scope="col">Pollster</th><th scope="col">Fieldwork</th><th scope="col">Sample</th><th scope="col">ALP 2PP</th><th scope="col">L/NP 2PP</th></tr></thead>
        <tbody>${rows}
        </tbody>
      </table>
      </div>

      <h2>Sources</h2>
      <p>${esc(sources)}. Field dates and sample sizes are listed per poll in the archive.</p>

      <p class="ss-note" data-nosnippet>${esc(J.brand)} tracker is an unofficial aggregator of published ${esc(J.adj)} opinion polling,
        part of <a href="${SITE_URL}">auspol tracker</a>. The figures are estimates only.</p>
    </article>`;
}

if (!html.includes("<!--STATIC_SUMMARY-->")) throw new Error("STATIC_SUMMARY marker not found in template");
html = html.replace("<!--STATIC_SUMMARY-->", "\n    " + (VIC ? buildStaticSummaryVic() : buildStaticSummary()) + "\n  ");

/* The share card carries live figures, so it can be WRONG in a way the old
   generic one could not. build.mjs cannot draw it - no rasteriser here, and it
   needs the page's own webfonts (see make-card.js) - but it can refuse to let
   a stale one pass unremarked, and it can stop scrapers serving a cached old
   card once a new one exists. The date the card was drawn for is recorded
   beside it; ?v= makes every redraw a new URL as far as a scraper is
   concerned, because they key their caches on the full URL.

   Stamped on publishedISO, which is the date the card puts on its own face.
   It was updatedISO - the end of the most recent poll's FIELDWORK - and a
   correction to a poll's publisher moves one and not the other, so the check
   could call a card current while it showed a date the site no longer did. */
/* The contest the card quotes. The card draws Labor against the rival the
   site leads with - gen-data's rivalLead, the deadbanded walk over the
   implied series that also picks the hero's contest and the favicon's
   needle. When that rival is One Nation the figures are latest.onImp's
   (the pairing's only quoted level; its interval is the flow table's RANGE,
   not a sampling interval), and the pollsters' published head-to-heads the
   only fallback. make-card.js's Q builds this same view from the same
   dataset - the two must never disagree about what the card says, or the
   stamp below calls a current card stale. */
function cardContest() {
  const src = fs.readFileSync(DA(DATASET), "utf8");
  const grab = (name) => {
    const i = src.indexOf("const " + name + " = ");
    if (i < 0) throw new Error(name + " not found in dataset");
    return JSON.parse(src.slice(i + name.length + 9, src.indexOf("\n", i)).replace(/;$/, ""));
  };
  const L = grab("latest"), S = grab("synthLatest"), alt = grab("altLatest");
  const hv = headlineView(L, S);
  const onImp = L.onImp && L.onImp.a != null ? L.onImp : null;
  const onPub = alt && alt.alp_on && alt.alp_on.a != null ? alt.alp_on : null;
  if (L.rivalLead !== "alp_on" || (!onImp && !onPub))
    return { ...hv, vs: "lnp", oppLab: "Coalition" };
  const s = onImp || onPub;
  return { ...hv, vs: "onp", oppLab: "One Nation",
           alp2pp: s.a, lnp2pp: s.b,
           alp2ppCi95: onImp ? s.band : s.ci95,
           alp2ppPrev: s.aPrev, changeSig: !!s.changeSig,
           method: { ...hv.method, nPolls: s.n },
           basis: onImp ? "imp" : "pub" };
}
/* The card's figure block, in exactly the shape make-card.js stamps into
   assets/auspol-card.json – mirror any change in both files. Written out as
   a machine-readable sidecar so render-card's staleness gate (and any future
   consumer) reads it here instead of string-splitting the dataset asset the
   way grabLatest does. */
function cardFigs(L) {
  return { vs: L.vs, alp: L.alp2pp.toFixed(1), lnp: L.lnp2pp.toFixed(1),
           ci: L.alp2ppCi95.toFixed(1),
           n: L.method.nPolls, win: L.method.windowDays,
           mom: (L.alp2pp - (L.alp2ppPrev != null ? L.alp2ppPrev : L.alp2pp)).toFixed(1),
           sig: !!L.changeSig,
           basis: L.basis };
}
const cardNow = cardContest();
if (!VIC) writeAtomic(path.join(ROOT, "assets", "auspol-latest.json"),
  JSON.stringify({ publishedISO: cardNow.publishedISO, fig: cardFigs(cardNow) }) + "\n");
let cardStamp = null, cardFigsDrawn = null;
try {
  const drawn = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "auspol-card.json"), "utf8"));
  cardStamp = drawn.publishedISO;
  cardFigsDrawn = drawn.fig || null;
} catch (_) { /* no stamp: reported below */ }
const dataStamp = cardNow.publishedISO;
if (VIC) {
  /* /vic/ has no share card of its own yet: its previews carry the title and
     description only (no og:image), so there is no stamp to check */
} else if (cardStamp !== dataStamp) {
  /* Warn-only locally: the unattended pipelines build on every new poll and
     redraw the card in a separate step, so a hard fail would stop data
     updates over a stale preview image. In the tests workflow the mismatch
     IS the signal that a card redraw was committed without its stamp (or a
     data update landed without one) - fail there so the run goes red. */
  if (process.env.CI && process.env.GITHUB_WORKFLOW === "tests") {
    console.error(`\nshare card is drawn for ${cardStamp || "an unrecorded date"}, data is ${dataStamp}`);
    console.error(`regenerate: see .build/newtracker/make-card.js, then update assets/auspol-card.json\n`);
    process.exit(1);
  }
  console.warn(`\n  ! share card is drawn for ${cardStamp || "an unrecorded date"}, data is ${dataStamp}`);
  console.warn(`    it will preview figures that are not the ones on the page.`);
  console.warn(`    regenerate: see .build/newtracker/make-card.js, then update assets/auspol-card.json\n`);
} else if (cardFigsDrawn && JSON.stringify(cardFigsDrawn) !== JSON.stringify(cardFigs(cardNow))) {
  /* Same poll date, but what the card SHOWS has moved (decay drift, a cured
     wave). Advisory only, not a tests-gate red: figure staleness heals on
     the daily prediction-refresh redraw, and correcting commits shouldn't
     have to spin Chrome. render-card's gate uses the same comparison. */
  console.warn(`\n  ! share card figures moved since it was drawn (date still current);`);
  console.warn(`    the next gated render-card run will redraw it.\n`);
} else {
  console.log(`  share card: current (${cardStamp})`);
}
/* The bust key is the STAMP, not the current data: the URL must change exactly
   when the card's pixels change. Date alone misses figure-only redraws, so
   when the stamp carries a fig block it joins the key. */
const cardFigKey = cardFigsDrawn
  ? "-" + crypto.createHash("sha1").update(JSON.stringify(cardFigsDrawn)).digest("hex").slice(0, 8)
  : "";
const cardUrl = `${SITE_URL}assets/auspol-card.png?v=${(cardStamp || dataStamp) + cardFigKey}`;
/* The card is now a chart with figures on it, so its alt says them. Someone
   who cannot see the preview should get the same reading from it. */
const cl = cardContest();
const cardAlt = `auspol tracker: Labor ${cl.alp2pp.toFixed(1)}, ${cl.oppLab} ${cl.lnp2pp.toFixed(1)} `
  + `two-party preferred${basisClause(cl)}, ±${cl.alp2ppCi95.toFixed(1)} points, updated ${cl.updated}, `
  + `with the trend since the 2025 election`;
/* SERP + social description. It opens with the site's name because Google
   rewrites a snippet that doesn't match the query: on a search for "auspol
   tracker" it skipped the old tagline-first description and quoted the
   footer disclaimer, the one page line that began with the name. The date
   leads the race sentence so a stale cached snippet stays self-dating even
   after Google truncates it (~160 characters). Keeps the site's headline
   race sentence - Labor v the Coalition - even when the share card is
   quoting the leading contest (the cardAlt above follows the card). */
const hl = grabLatest();
const JV = VIC ? DATA.jurisdiction : null;
const metaDesc = VIC
  ? `${JV.brand} tracker averages every published ${JV.adj} state opinion poll. `
    + `As of ${hl.updated}, ${raceLine(hl).replace(/^The /, "the ")} two-party preferred${basisClause(hl)} (±${hl.alp2ppCi95}), `
    + `from ${hl.pollsTracked} polls by ${hl.housesTracked} pollsters. Election day: ${hl.nextElectionDue}.`
  : `auspol tracker averages every published Australian federal opinion poll. `
  + `As of ${hl.updated}, ${raceLine(hl).replace(/^The /, "the ")} two-party preferred${basisClause(hl)} (±${hl.alp2ppCi95}), `
  + `from ${hl.pollsTracked} polls by ${hl.housesTracked} pollsters. `
  + `Primary votes, every poll, and the last ${pastCycleWord()} elections for comparison.`;

/* Structured data. With no Wikipedia entry, Google's knowledge of the site
   (and its "About this result" source panel) is auto-derived from crawled
   text; schema.org markup is the one channel that states the facts directly.
   WebSite + its publisher Organization reuses metaDesc so the declared
   description can never drift from the one crawlers see. "<" is escaped the
   JSON way so a stray "</" in the copy can't end the script early. */
const websiteJsonLd = `<script type="application/ld+json">${
  JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "auspol tracker",
    alternateName: "auspoltracker.com",
    url: SITE_URL,
    description: metaDesc,
    inLanguage: "en-AU",
    publisher: {
      "@type": "Organization",
      name: "auspol tracker",
      url: SITE_URL,
      ...(favPng ? { logo: `${SITE_URL}assets/favicon-192.png` } : {}),
    },
  }).replace(/</g, "\\u003c")
}</script>`;

/* og:site_name must NOT equal the masthead h1 text: Safari Reader skips any
   title candidate whose text equals og:site_name when og:title exists (its
   site-name de-dup), so "auspol tracker" here disqualified the h1 and let
   "Two-party preferred" win. The domain keeps the two distinct. */
const OG_ANCHOR = '<meta property="og:type" content="website">';
if (!html.includes(OG_ANCHOR)) throw new Error("og:type meta anchor not found in template");
html = html.replace(OG_ANCHOR, VIC
  ? `<meta name="description" content="${metaDesc}">
  <meta property="og:type" content="website">
  <meta property="og:description" content="${metaDesc}">
  <meta property="og:site_name" content="auspoltracker.com">
  <meta property="og:locale" content="en_AU">
  <meta property="og:url" content="${PAGE_URL}">
  <meta name="twitter:card" content="summary">
  <meta name="theme-color" content="${THEME_LIGHT}" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="${THEME_DARK}" media="(prefers-color-scheme: dark)">
  <link rel="canonical" href="${PAGE_URL}">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${favicon}">
  ${fontLinks.join("\n  ")}`
  : `<meta name="description" content="${metaDesc}">
  <meta property="og:type" content="website">
  <meta property="og:description" content="${metaDesc}">
  <meta property="og:site_name" content="auspoltracker.com">
  <meta property="og:locale" content="en_AU">
  <meta property="og:url" content="${SITE_URL}">
  <meta property="og:image" content="${cardUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${cardAlt}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="google-site-verification" content="sUMvJK3smMtuRAQNZiu9yW3FPS5rD4XI_eod7Dc6k5g">
  <meta name="theme-color" content="${THEME_LIGHT}" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="${THEME_DARK}" media="(prefers-color-scheme: dark)">
  <link rel="canonical" href="${SITE_URL}">
  <link rel="alternate" type="application/rss+xml" title="auspol tracker – new polls" href="${SITE_URL}feed.xml">
  ${favPng ? `<link rel="icon" type="image/png" sizes="192x192" href="${SITE_URL}assets/favicon-192.png">
  ` : ""}<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${favicon}">
  ${fontLinks.join("\n  ")}
  ${websiteJsonLd}`);

if (VIC) {
  const t = `${JV.brand} tracker – ${JV.electionWords} election polling`;
  html = html.replace("<title>auspol tracker – Australian federal election polling</title>", `<title>${t}</title>`)
    .replace('<meta property="og:title" content="auspol tracker – Australian federal election polling">', `<meta property="og:title" content="${t}">`);
}

/* ---- 5. inline every script ------------------------------------------- */
const parts = [];
/* The cycle-source rows are the individual polls behind every past term. They
   are ~240KB, they are read by nothing outside the Past-cycles tab - its dots
   and its source-polls CSV - and they used to ride in the document as an inert
   application/json block, which cost every visitor the download whether or not
   they ever opened that tab.
   They are a file now, fetched when the tab opens. Named by a hash of its own
   bytes so it caches immutably and a new build invalidates it on its own. */
const cycleSourceJson = fs.readFileSync(DA("cycle-source.json"), "utf8");
const cycleSrcName = `cycle-source.${hash8(Buffer.from(cycleSourceJson))}.json`;
/* /vic/ has no past terms yet, so no source rows to fetch – and its build must
   not sweep the federal page's file out of assets/ */
if (!VIC) {
for (const old of fs.readdirSync(path.join(ROOT, "assets"))) {
  if (/^cycle-source\..*\.json$/.test(old) && old !== cycleSrcName)
    fs.unlinkSync(path.join(ROOT, "assets", old));
}
writeAtomic(path.join(ROOT, "assets", cycleSrcName), cycleSourceJson);
}
parts.push(`<script>window.AP_CYCLE_SRC=${VIC ? "null" : JSON.stringify("assets/" + cycleSrcName)};<\/script>`);
for (const f of ["react.production.min.js", "react-dom.production.min.js"])
  parts.push(`<script>${inlineJs(fs.readFileSync(path.join(HERE, "vendor", f), "utf8"))}</script>`);
for (const f of PLAIN)
  parts.push(`<script>${inlineJs(stripJs(fs.readFileSync(f === DATASET ? DA(f) : A(f), "utf8"), f))}</script>`);
for (const f of JSX)
  parts.push(`<script>${inlineJs(transpile(fs.readFileSync(A(f), "utf8"), f))}</script>`);

/* Splice the inlined scripts in at an explicit marker.
   This used to find the first <script src="{uuid}"> and cut to the LAST
   </script> in the file, which silently depended on every script tag being
   uuid-named and on none of them being the last tag for any other reason. */
if (!html.includes("<!--SCRIPTS-->")) throw new Error("SCRIPTS marker not found in template");
/* Same for the stylesheets (~50KB gzipped of comments). Done before the
   scripts go in, so the <style> match can only see the template's own blocks.
   The template carries no "/*" inside a quoted CSS string. */
html = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (_, open, css, close) =>
  open + css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n[ \t]*(?=\n)/g, "").replace(/\n{2,}/g, "\n") + close);
html = html.replace("<!--SCRIPTS-->", parts.join("\n  "));
/* /vic/ sits one folder down: the shared fonts are site-root assets */
if (VIC) html = html.replace(/href="assets\//g, 'href="/assets/').replace(/url\("assets\//g, 'url("/assets/');

writeAtomic(OUT, html);
if (VIC) {
  const vsize = fs.statSync(OUT).size;
  console.log(`built ${path.relative(ROOT, OUT)} · ${(vsize / 1024 / 1024).toFixed(2)} MB raw · ${(zlibVic.gzipSync(html, { level: 6 }).length / 1024).toFixed(0)} KB gzipped`);
  process.exit(0);
}

/* ---- 5b. feed.xml – one item per poll ----------------------------------
   The page is a single document that changes in place, so there was no way to
   follow it except by checking. A feed is the cheapest possible answer: it
   costs one file at build time, needs no server, and lets a reader (or another
   tracker) find out that a poll landed without opening anything.

   An item is a POLL, not a site update, because that is the unit people
   actually want to hear about, and it links to the pollster's own release
   where there is one - the tracker has no per-poll page to link to, and
   sending a reader to the primary source is the better answer anyway. */
const XML_ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const xesc = (v) => String(v).replace(/[&<>"']/g, (c) => XML_ESC[c]);
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fieldLabel = (p) => {
  const [, em, ed] = p.date.split("-").map(Number);
  if (!p.dateStart) return `${ed} ${MONTHS_SHORT[em - 1]}`;
  const [, sm, sd] = p.dateStart.split("-").map(Number);
  return sm === em ? `${sd}–${ed} ${MONTHS_SHORT[em - 1]}`
                   : `${sd} ${MONTHS_SHORT[sm - 1]} – ${ed} ${MONTHS_SHORT[em - 1]}`;
};
// noon UTC: a date-only fieldwork end has no time of day, and midnight would
// land readers in the previous day west of Greenwich
const rfc822 = (iso) => new Date(iso + "T12:00:00Z").toUTCString();

/* One item is a RELEASE WAVE: every measure the tracker holds for one house's
   one release rides a single item – voting intention, alternate two-party
   matchups, leader ratings and preferred PM, national direction, the issues
   (salience and best party), the vote by group, the switch from the 2025
   vote, undecided and soft shares, sample and fieldwork. Waves with no
   voting-intention figure – SEC Newgate's direction-only releases, the Ipsos
   Issues Monitor – get an item of their own rather than none. */
const ISSUES = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "issues.json"), "utf8"));
const DEMO = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "demographics.json"), "utf8"));
const SWITCH = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "vote-switching.json"), "utf8"));
const waves = new Map(); // `${house}|${date}` -> every measure on record for the wave
const waveOf = (house, date, dateStart) => {
  const k = `${house}|${date}`;
  let w = waves.get(k);
  if (!w) waves.set(k, (w = { house, date, dateStart }));
  if (!w.dateStart && dateStart) w.dateStart = dateStart;
  return w;
};
for (const p of DATA.polls) if (!p.isElection) waveOf(p.pollster, p.date, p.dateStart).poll = p;
for (const a of DATA.approval || []) waveOf(a.firm, a.date).approval = a;
for (const m of DATA.ppm || []) waveOf(m.firm, m.date).ppm = m;
for (const h of DATA.ppmHeadToHead || []) waveOf(h.firm, h.date).h2h = h;
for (const t of DATA.altTpp || []) waveOf(t.firm, t.date).alt = t;
for (const d of DATA.direction || []) waveOf(d.pollster, d.date, d.dateStart).dir = d;
for (const s of ISSUES.salience || []) waveOf(s.pollster, s.date, s.dateStart).sal = s;
for (const o of ISSUES.ownership || []) waveOf(o.pollster, o.date, o.dateStart).own = o;
for (const g of DEMO.waves || []) waveOf(g.pollster, g.date).demo = g;
for (const v of SWITCH.waves || []) waveOf(v.pollster, v.date).sw = v;
const feedWaves = [...waves.values()]
  .sort((a, b) => b.date.localeCompare(a.date) || a.house.localeCompare(b.house))
  .slice(0, 40);

const PARTY = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON", ind: "IND", oth: "OTH" };
const r1 = (v) => Math.round(v * 10) / 10;
const shareLine = (p) => {
  const bits = [["ALP", p.alp], ["L/NP", p.lnp], ["GRN", p.grn], ["ON", p.onp],
                ["Ind/Oth", (p.ind ?? 0) + (p.oth ?? 0) || null]]
    .filter(([, v]) => v != null).map(([k, v]) => `${k} ${v}`);
  return bits.join(", ");
};
// `GRN 6 · IND 3` out of any {code: pct} bag; unknown codes print as-is
const bits = (o) => Object.entries(o)
  .filter(([, v]) => v != null)
  .map(([k, v]) => `${PARTY[k] || k} ${r1(v)}`)
  .join(" · ");

const items = feedWaves.map((w) => {
  const p = w.poll || null, year = w.date.slice(0, 4);
  const tpp = p && p.tpp_alp != null ? `ALP ${p.tpp_alp} – L/NP ${p.tpp_lnp}` : null;
  const head = tpp ? `2PP ${tpp}`
    : p ? shareLine(p)
    : w.dir ? `Right ${w.dir.right} · Wrong track ${w.dir.wrong}`
    : w.sal || w.own ? "the issues"
    : w.sw ? "vote switching"
    : w.demo ? "the vote by group"
    : "polling release";
  const title = `${w.house}, ${fieldLabel(w)} ${year} – ${head}`;
  const parts = [];
  if (p) {
    parts.push(`Primary vote: ${shareLine(p)}.`);
    parts.push(tpp ? `Two-party preferred: ${tpp}.` : "No two-party figure published.");
    if (p.tpp3) parts.push(`Three-way (ALP v L/NP v ON): ALP ${p.tpp3.alp} · L/NP ${p.tpp3.lnp} · ON ${p.tpp3.onp}.`);
    if (p.undecided != null) parts.push(`Undecided ${p.undecided}%.`);
    if (p.soft != null)
      parts.push(`Soft vote ${p.soft}%` +
        (p.softAge ? ` by age (${Object.entries(p.softAge).map(([a, v]) => `${a}: ${v}%`).join(", ")})` : "") + ".");
  }
  if (w.alt) {
    const alts = [];
    if (w.alt.alpVsOnp_alp != null) alts.push(`ALP ${r1(w.alt.alpVsOnp_alp)} – ON ${r1(100 - w.alt.alpVsOnp_alp)}`);
    if (w.alt.lnpVsOnp_lnp != null) alts.push(`L/NP ${r1(w.alt.lnpVsOnp_lnp)} – ON ${r1(100 - w.alt.lnpVsOnp_lnp)}`);
    if (alts.length) parts.push(`Other two-party contests: ${alts.join(" · ")}.`);
  }
  if (w.ppm) parts.push(`Preferred PM: Albanese ${w.ppm.alb} – ${w.ppm.oppName || "opposition leader"} ${w.ppm.opp}` +
    (w.ppm.han != null ? ` – Hanson ${w.ppm.han}` : "") + ".");
  if (w.h2h) parts.push(`Preferred PM, Albanese v Hanson: ${w.h2h.alb} – ${w.h2h.han}.`);
  if (w.approval) {
    const det = w.approval.detail || {};
    const seg = (name, net, d) =>
      `${name} ${net >= 0 ? "+" : ""}${net} net${d ? ` (${d.app}% approve, ${d.dis}% disapprove)` : ""}`;
    const ratings = [seg("Albanese", w.approval.alb, det.alb),
                     seg(w.approval.oppName || "Opposition leader", w.approval.opp, det.opp)];
    if (w.approval.han != null) ratings.push(seg("Hanson", w.approval.han, det.han));
    parts.push(`Satisfaction: ${ratings.join("; ")}.`);
  }
  if (w.dir)
    parts.push(`National direction: right direction ${w.dir.right}% · wrong track ${w.dir.wrong}%` +
               (w.dir.unsure != null ? ` · unsure ${w.dir.unsure}%` : "") + ".");
  if (w.sal) {
    const seen = Object.entries(w.sal.issues).map(([k, v]) => {
      const lab = ISSUES.issues[k] || k;
      const t3 = v.top3 != null ? `${r1(v.top3)}% in the top three` : null;
      const first = v.r1 != null ? `${r1(v.r1)}% rank it first` : null;
      return `${lab}: ${[t3, first].filter(Boolean).join(", ") || "no figure"}`;
    });
    parts.push(`The issues, what voters say matters: ${seen.join("; ")}.`);
  }
  if (w.own) {
    const OPT = { alp: "ALP", lnp: "L/NP", onp: "ON", grn: "GRN", oth: "other",
                  equal: "all equal", none: "neither", unsure: "unsure" };
    const seen = Object.entries(w.own.issues).map(([k, v]) => {
      const lab = ISSUES.issues[k] || k;
      const shares = Object.entries(v).filter(([, x]) => x != null)
        .map(([kk, x]) => `${OPT[kk] || kk} ${r1(x)}%`);
      return `${lab}: ${shares.join(" · ")}`;
    });
    parts.push(`And the party voters see as best on each: ${seen.join("; ")}.`);
  }
  if (w.demo) {
    const dims = Object.entries(w.demo.dims).map(([dim, groups]) =>
      `${dim} – ${Object.entries(groups).map(([g, parties]) => `${g}: ${bits(parties)}`).join("; ")}`);
    parts.push(`The vote by group (${Object.keys(w.demo.dims).join(", ")}): ${dims.join(". ")}.`);
  }
  if (w.sw) {
    const moves = Object.entries(w.sw.rows).map(([grp, row]) =>
      `2025 ${PARTY[grp] || grp} voters now: ${bits(row)}`);
    parts.push(`Where the 2025 vote has moved: ${moves.join(". ")}.`);
  }
  const n = p?.sample ?? w.sal?.sample ?? w.own?.sample ?? w.demo?.sample ?? w.sw?.sample;
  if (n != null) parts.push(`Sample ${n.toLocaleString("en-AU")}.`);
  parts.push(`Fieldwork ${fieldLabel(w)} ${year}.`);
  const link = p?.url || w.dir?.url || w.sal?.source || w.own?.source
             || w.demo?.article || w.demo?.source || w.sw?.article || w.sw?.source || SITE_URL;
  return `    <item>
      <title>${xesc(title)}</title>
      <link>${xesc(link)}</link>
      <guid isPermaLink="false">auspol-tracker:${xesc(w.date + "|" + w.house)}</guid>
      <pubDate>${rfc822(w.date)}</pubDate>
      <description>${xesc(parts.join(" "))}</description>
    </item>`;
}).join("\n");
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>auspol tracker – new polls</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}feed.xml" rel="self" type="application/rss+xml"/>
    <description>Every national polling release as it enters the tracker – voting intention, leader ratings, national direction, the issues and vote breakdowns included. Items link to the pollster's own release.</description>
    <language>en-AU</language>
    <lastBuildDate>${rfc822(grabLatest().updatedISO)}</lastBuildDate>
${items}
  </channel>
</rss>
`;
writeAtomic(path.join(ROOT, "feed.xml"), feed);

/* ---- 5c. robots.txt + sitemap.xml – be findable -------------------------
   A single-page site is trivially mappable, but a crawler still has to learn
   the page exists and when it last changed. The sitemap carries the one
   canonical URL with the data date as lastmod; robots.txt points crawlers at
   it. auspol-polling.html belongs in neither: its noindex meta is the honest
   signal, and a Disallow would hide that meta from the crawler. Both files
   key off SITE_URL, so a future CNAME moves them for free – and robots.txt
   is inert at a github.io project path (only the host-root file is honoured)
   precisely until one exists. */
/* The hand-maintained poll archives were first added by editing this OUTPUT
   file, so every rebuild dropped them again; they live here now. Their
   lastmod is a fixed date — the build can't know when those pages last
   changed, so anyone touching them bumps ARCHIVE_STAMP. /newspoll-archive/
   itself is only a redirect stub to /archives/newspoll/ and stays OUT of the
   sitemap (canonical entry points belong to the real pages). */
const ARCHIVE_STAMP = "2026-09-24";
/* prediction/ is not hand-maintained: it regenerates daily via
   .build/refresh-prediction.mjs, which bumps this stamp itself. Dating those
   runs with ARCHIVE_STAMP would falsely datestamp the hand-maintained pages. */
const PREDICTION_STAMP = "2026-10-07";
/* vic/ is rebuilt from data/vic-polls.json (npm run build:vic), so it is
   dated as this page is, by its data – the newest Victorian poll's
   fieldwork end – or by the rebuild onto this page's code, 2026-10-05,
   whichever is later. */
const VIC_STAMP = (() => {
  const CODE = "2026-10-05";
  try {
    const v = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "vic-polls.json"), "utf8"));
    const data = [...(v.polls || []), ...(v.leadership || [])].map((r) => r.fwEnd || r.date).filter(Boolean).sort().pop() || CODE;
    return data > CODE ? data : CODE;
  } catch { return CODE; }
})();
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${dataStamp}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}archives/newspoll/</loc>
    <lastmod>${ARCHIVE_STAMP}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}archives/acnielsen/</loc>
    <lastmod>${ARCHIVE_STAMP}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}archives/morgan/</loc>
    <lastmod>${ARCHIVE_STAMP}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}archives/galaxy/</loc>
    <lastmod>${ARCHIVE_STAMP}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}archives/aeforecasts/</loc>
    <lastmod>${ARCHIVE_STAMP}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}archives/trove/</loc>
    <lastmod>${ARCHIVE_STAMP}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}atlas/</loc>
    <lastmod>${ARCHIVE_STAMP}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}feedback/</loc>
    <lastmod>${ARCHIVE_STAMP}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}preference-flows/</loc>
    <lastmod>${ARCHIVE_STAMP}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}prediction/</loc>
    <lastmod>${PREDICTION_STAMP}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}vic/</loc>
    <lastmod>${VIC_STAMP}</lastmod>
  </url>
</urlset>
`;
writeAtomic(path.join(ROOT, "sitemap.xml"), sitemapXml);
writeAtomic(path.join(ROOT, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`);

/* ---- 6. report --------------------------------------------------------- */
import zlib from "node:zlib";
const size = fs.statSync(OUT).size;
/* wire-size estimate from the in-memory page: level 6 is what static hosts
   roughly serve, and re-reading + level 9 cost a quarter-second for a log
   line nothing parses */
const gz = zlib.gzipSync(html, { level: 6 }).length;
console.log(`built ${path.basename(OUT)}`);
console.log(`  ${(size / 1024 / 1024).toFixed(2)} MB raw · ${(gz / 1024).toFixed(0)} KB over the wire (gzipped)`);
console.log(`  + assets/fonts · ${[...fontKeep].length} faces, ${(FONTS.reduce((n, f) => n + fs.statSync(path.join(HERE, "fonts", f.file)).size, 0) / 1024).toFixed(0)} KB, cached by hash`);
console.log(`  + assets/${cycleSrcName} · ${(Buffer.byteLength(cycleSourceJson) / 1024).toFixed(0)} KB, fetched only by Past cycles`);
console.log(`built feed.xml · ${feedWaves.length} waves, newest ${feedWaves[0].date} ${feedWaves[0].house}`);
console.log(`built sitemap.xml · lastmod ${dataStamp}`);
console.log("built robots.txt");
