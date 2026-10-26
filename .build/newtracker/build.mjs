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
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { writeAtomic } from "../atomic-write.mjs";
import zlibVic from "node:zlib";
import { validate } from "./validate.mjs";
import { rewriteTideArt } from "./tide-art.mjs";
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
/* gen-data's whole job is these files. Everything downstream of this
   line reads them by name, so if either is missing or empty the diagnosis
   belongs here, not in a readFileSync ENOENT two hundred lines later. */
for (const rel of ["9f09dca2-bd46-49a8-8ae1-51847608cf92.js", "cycle-source.json",
                   ...(VIC ? [] : ["oneoffs-source.json"])]) {
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
  "pv-agg.js", // the Primary tab's pollster-subset recompute (needs window.AP; the parity test evals this same file)
  "menu-lines.js", // the menu pages' findings: their heads, the More menu's lines (build.mjs runs it in node too)
  "copy-chart.js", // per-chart copy-as-image button
  "copy-poll.js",  // copy-as-image button for the expanded poll breakdown
];
const JSX = [
  "08b413e7-8dbe-49bf-8932-a479f8d98f54.js",  // chart toolkit
  "a11e1559-f455-44d5-8a31-6699de4ef310.js",  // panels
  "d1a1d215-370c-4ebc-878b-7eeea9ad8102.js",  // tabbed views
  "wm-story.jsx",                             // the wordmark dial, replayed
  "rd.jsx",                                   // the redesign's own pieces (sections, gauges, tables)
  "rd-hero.jsx",                              // the redesign's two-party section
  "rd-panels.jsx",                            // the redesign's other Snapshot sections
  "rd-polls.jsx",                             // the redesign's latest-and-next polls table
  "rd-cycles.jsx",                            // the redesign's Past cycles tab
  "rd-allpolls.jsx",                          // the redesign's All polls tab
  "rd-beyond.jsx",                            // the ☰ menu's Public opinion page
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
   live under it. Two prunes, both in tcInit:
     - a fortnight age prune  (a stale line never leaves);
     - a byte cap             (sessions churn the cache ~60MB/day via unique
                               source hashes; 307MB accumulated in five days
                               of October 2026 before anyone pruned it).
   The cap is enforced at init, before this build writes its fresh entries,
   so the steady state is CAP + one build's writes — bounded at ~66MB, never
   the unbounded growth of Oct 2026 (live-verified 2026-10-15: 78MB seeded,
   one build leaves ≤ CAP + this run's ~2.8MB).
   The cache dir is gitignored scratch – deleting it just makes the next
   build recompute. */
const TC_CAP_BYTES = 64 * 1024 * 1024;
let tcInit = null;
const babelCached = (mode, code, name, extra) => {
  if (!tcInit) {
    tcInit = {
      dir: path.join(HERE, ".transpile-cache"),
      key: hash8(fs.readFileSync(path.join(HERE, "vendor", "babel-standalone.js"))),
    };
    fs.mkdirSync(tcInit.dir, { recursive: true });
    const now = Date.now();
    let bytes = 0;
    const entries = [];
    for (const f of fs.readdirSync(tcInit.dir)) {
      const p = path.join(tcInit.dir, f);
      const st = fs.statSync(p);
      if (now - st.mtimeMs > 14 * 864e5) { fs.unlinkSync(p); continue; }
      bytes += st.size;
      entries.push({ p, mtimeMs: st.mtimeMs, size: st.size });
    }
    if (bytes > TC_CAP_BYTES) {
      // oldest-first eviction; a fresh entry never gets evicted by this pass
      entries.sort((a, b) => a.mtimeMs - b.mtimeMs);
      for (const e of entries) {
        if (bytes <= TC_CAP_BYTES) break;
        fs.unlinkSync(e.p);
        bytes -= e.size;
      }
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
/* gen-data writes each big table as one `const name = <JSON>;` line. Through
   Babel's printer those came out as 95,000 lines of indented object literal
   (1.74MB in, 2.65MB out), and V8 builds a large literal far slower than it
   parses the same text as JSON. Each such line >= 10KB is shipped as
   JSON.parse('…') instead: dataset eval 42 -> 17ms in node (more on a
   throttled phone), ~17KB less gzipped, and window.AUSPOL deep-equal (the
   build checks it below). A line that isn't strict JSON (a function, a
   computed value) is left to the printer as before. No "__proto__" key can
   ride along: a literal would set the prototype where JSON.parse sets a key. */
/* The dataset in two halves. The first screen (the hero, the header, the
   next-polls ticker) reads a handful of tables; the rest - and the bulk of
   each poll row (its group breakdowns, links, change notes, yardsticks,
   issue and direction readings) - only the sections and views that load
   after the first paint read (loadLate, 73de0c58). Measured 2026-10-25 by
   instrumenting every table and poll field: none of these is read before
   the late modules land, at desktop or phone width. They ship as
   data[-vic]-late.<hash>.js, which patches window.AUSPOL in place - the
   tables by name (each is referenced only by the IIFE's return object, so
   the main half declares it undefined), the poll fields by row index.
   Root documents load it first in the late list; tab documents load it as
   a plain script straight after the dataset. The More menu's own tables
   (houseLean, flowDrift) stay in the main half: the menu can open first. */
const LATE_TABLES = ["onSources", "flowHistory", "primaryHistory", "confDeep", "pollsterTable", "directionGroups", "demoTrend", "confHistory",
  "twoPPHistory", "informalHistory", "yardLine", "ldYardLine", "confidence", "undecided", "demographics", "issues"];
const LATE_POLL_FIELDS = ["grp", "links", "chg", "yd", "url", "ldYd", "iss", "dir", "pyd", "peff", "eff", "methodUrl"];
const splitDataset = (code) => {
  const tables = {};
  let rows = [];
  const lines = code.split("\n");
  const ret = lines.map((l) => /^\s*return \{/.test(l)).lastIndexOf(true);
  /* the lines that are code: not inside a comment, and not another table's
     JSON (a key or a word in either is no read) */
  let inComment = false;
  const isCode = lines.map((l) => {
    const t = l.trim();
    if (inComment) { if (t.includes("*/")) inComment = false; return false; }
    if (t.startsWith("/*")) { inComment = !t.includes("*/"); return false; }
    if (t.startsWith("//")) return false;
    const m = /^const [\w$]+ = (.+);$/.exec(t);
    if (m) { try { JSON.parse(m[1]); return false; } catch {} }
    return true;
  });
  const main = lines.map((line, at) => {
    const m = /^(\s*)const ([\w$]+) = (.+);\s*$/.exec(line);
    if (!m) return line;
    const [, ind, name, rhs] = m;
    if (LATE_TABLES.includes(name)) {
      /* only the return object may read it: nothing between its
         declaration and the return statement can, while the IIFE runs */
      const re = new RegExp(`\\b${name}\\b`);
      const early = lines.slice(at + 1, ret).filter((l, k) => isCode[at + 1 + k] && re.test(l)).length;
      if (ret < 0 || early) throw new Error(`dataset split: ${name} is read ${early} time(s) before the return object`);
      tables[name] = JSON.parse(rhs);
      /* a same-shaped stand-in until the late half lands, so a reader's
         "is there one" (the hero's section links) answers as it always did */
      const v = tables[name];
      return `${ind}const ${name} = ${Array.isArray(v) ? "[]" : v && typeof v === "object" ? "{}" : JSON.stringify(v)};`;
    }
    if (name === "individualPolls") {
      const polls = JSON.parse(rhs);
      rows = polls.map((p, i) => {
        const moved = {};
        for (const k of LATE_POLL_FIELDS) if (k in p) { moved[k] = p[k]; delete p[k]; }
        return Object.keys(moved).length ? [i, moved] : null;
      }).filter(Boolean);
      return `${ind}const ${name} = ${JSON.stringify(polls)};`;
    }
    return line;
  }).join("\n");
  const payload = JSON.stringify({ t: tables, f: rows }).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const late = `/* the dataset's late half - see splitDataset in build.mjs */
(function () {
  var A = window.AUSPOL, L = JSON.parse(${JSON.stringify(payload).replace(/[\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"))});
  for (var k in L.t) A[k] = L.t[k];
  var P = A.individualPolls;
  L.f.forEach(function (e) { var o = P[e[0]]; for (var f in e[1]) o[f] = e[1][f]; });
})();`;
  return { main, late };
};
const jsonParseLiterals = (code) => code.split("\n").map((line) => {
  const m = /^(\s*(?:const|let|var)\s+[\w$]+\s*=\s*)(.+);\s*$/.exec(line);
  if (!m || m[2].length < 10240 || m[2].includes('"__proto__"')) return line;
  try { JSON.parse(m[2]); } catch { return line; }
  return `${m[1]}JSON.parse(${JSON.stringify(m[2])});`;
}).join("\n");

/* An inline <script> ends at the first literal "</script", wherever it appears
   – including inside a JS string. Escaping the slash is inert in JS. */
const inlineJs = (code) => code.replace(/<\/script/gi, "<\\/script");

/* ---- 4. template ------------------------------------------------------- */
let html = fs.readFileSync(path.join(HERE, "template.html"), "utf8");

/* -- the tide band's weekly vote-weighted recolour --------------------------
   The thirty traces closing the page are re-coloured by chance against the
   CURRENT primary vote (gen-data's latest.primary, read from the dataset it
   just wrote), the draw seeded by the Sydney ISO week – re-shuffled on the
   first build after Monday 12am, stable within the week, weights always
   live. Geometry and washed palette come out of the template's committed
   art (its single home); a null draw (empty estimator window) leaves the
   template art untouched. Federal also refreshes the satellites' /assets
   files from the same draw. See tide-art.mjs. */
{
  const src = fs.readFileSync(DA(DATASET), "utf8");
  const i = src.indexOf("const latest = ");
  const latest = i >= 0 ? JSON.parse(src.slice(i + 15, src.indexOf("\n", i)).replace(/;$/, "")) : null;
  const tide = rewriteTideArt(html, latest && latest.primary);
  html = tide.html;
  if (!VIC && tide.svgLight) {
    writeAtomic(path.join(ROOT, "assets", "tile-art.svg"), tide.svgLight + "\n");
    writeAtomic(path.join(ROOT, "assets", "tile-art-dark.svg"), tide.svgDark + "\n");
  }
}

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
  { file: "crimsontext-400-latin.woff2",        family: "Crimson Text", style: "normal", weight: "400" },
  /* What the first screen sets in 400 - the tagline (and the colophon's
     line, the classic design's one heading) - is a fixed handful of
     letters: they ship as a 5.4KB subset (pyftsubset, layout kept) that is
     preloaded in place of the 16.7KB face. Same family, declared after the
     full face: where two faces of a family cover a character the later one
     answers, so these letters come from the subset and anything else falls
     to the full face, fetched only if something asks. */
  { file: "lede-crimson400.woff2",              family: "Crimson Text", style: "normal", weight: "400", preload: true,
    range: "U+0020, U+002C, U+002E, U+0030, U+0031, U+0032, U+0033, U+0034, U+0035, U+0036, U+0037, U+0038, U+0039, U+0041, U+004C, U+0056, U+0061, U+0062, U+0063, U+0064, U+0065, U+0066, U+0067, U+0068, U+0069, U+006B, U+006C, U+006E, U+006F, U+0070, U+0072, U+0073, U+0074, U+0075, U+0076, U+0078" },
  /* 600 normal is no longer preloaded (2026-10-25): no element of the
     default design sets in it - only the archived ?design=old view does,
     which can wait for it the way it waits for everything else. */
  { file: "crimsontext-600-latin.woff2",        family: "Crimson Text", style: "normal", weight: "600" },
  /* 700 normal IS preloaded (2026-10-25): every tab's headline (.rd-hed)
     sets in it on the first screen. Discovered only when the app rendered,
     it swapped in 0.6-1.2s into a load at 4x CPU and its taller ascent
     dropped the headline's glyphs 4px - a layout shift on every cold load. */
  { file: "crimsontext-700-latin.woff2",        family: "Crimson Text", style: "normal", weight: "700", preload: true },
  { file: "crimsontext-italic-400-latin.woff2", family: "Crimson Text", style: "italic", weight: "400" },
  /* italic-600 had no consumer (italic serif runs at 400 or 700 on the
     live page); the subset stays in fonts/ so re-registering it is one line. */
  { file: "crimsontext-italic-700-latin.woff2", family: "Crimson Text", style: "italic", weight: "700" },
  /* Source Serif 4 retired Sep 2026: the tab labels and docked score set in
     Crimson Text, the page's one serif. The source subset stays in fonts/. */
  { file: "ibmplexsans-latin.woff2",            family: "IBM Plex Sans", style: "normal", weight: "300 700", preload: true },
  /* Source Sans 3 sets the .wordmark lockup at the top of the first screen,
     so its letters ARE preloaded (2026-10-25; the subset below). Left to be discovered when the app
     rendered, it landed ~800ms in at 4x CPU and the system-sans fallback's
     taller line moved the wordmark and every line under it up 4-5px on
     every cold load - the page's only layout shift. The satellites' shell
     already preloaded it (site-shell.mjs fontPreloads). */
  { file: "sourcesans3-latin.woff2",            family: "Source Sans 3", style: "normal", weight: "400 800" },
  /* ...and what is preloaded is the lockup's own letters: Source Sans 3
     subset to "auspol", "vicpol" and "tracker" (pyftsubset --text, every
     layout feature and the weight axis kept, so the words draw exactly as
     the full face draws them), 3.2KB in place of the full face's 28.8KB on
     the first screen's path. Its unicode-range names only those letters, so
     any other character the lockup ever sets falls through to the full face
     above, which now loads only if something asks for it. */
  { file: "ss3mark-wordmark.woff2",             family: "Source Sans 3 Mark", style: "normal", weight: "400 800", preload: true,
    range: "U+0020, U+0061, U+0063, U+0065, U+0069, U+006B, U+006C, U+006F, U+0070, U+0072, U+0073, U+0074, U+0075, U+0076" },
  /* Archivo is retired: the expanded poll breakdown was its only consumer and
     that panel is now set in Source Sans 3 throughout. The source subset stays
     in fonts/ so re-registering it is a one-line change. */
  /* IBM Plex Mono – the Changelog tab page's console (ssChangelogBlock below;
     ChangelogEntries in the d1a1d215 asset). Restored 2026-10-15 after the
     page's first day as a tab set it in prose type (user: keep the old
     code-like chunk). Not preloaded: only the one tab page consumes it. */
  { file: "ibmplexmono-400-latin.woff2",        family: "IBM Plex Mono", style: "normal", weight: "400" },
  { file: "ibmplexmono-600-latin.woff2",        family: "IBM Plex Mono", style: "normal", weight: "600" },
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
  if (f.pageOnly) return null;
  const href = `assets/fonts/${name}`;
  /* Only the faces that paint text on the way in are preloaded. The italic
     serif sets a handful of small labels, so it can arrive with the rest of
     the page rather than competing with it for the first connections. */
  if (f.preload) fontLinks.push(`<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`);
  return `@font-face {
  font-family: '${f.family}';
  font-style: ${f.style};
  font-weight: ${f.weight};
  font-display: swap;
  src: url("${href}") format('woff2');
  unicode-range: ${f.range || LATIN};
}`;
}).filter(Boolean).join("\n");
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
     The rival is gen-data's rivalLead - the margin-gated ruling over the
     implied series (2PP first, first preferences on a tie) that decides
     which contest the hero leads with - and the margin
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
const headlineView = (L, S) => {
  const v = (S && S.alp != null)
    ? { ...L,
        alp2pp: S.alp, lnp2pp: S.lnp, alp2ppCi95: S.ci95, alp2ppNEff: S.nEff,
        alp2ppPrev: S.prev != null ? S.prev : L.alp2ppPrev, changeSig: S.changeSig,
        method: { ...L.method, nPolls: S.n },
        basis: "imp",
        pub: { alp2pp: L.alp2pp, lnp2pp: L.lnp2pp, alp2ppCi95: L.alp2ppCi95 } }
    : { ...L, basis: "pub",
        pub: { alp2pp: L.alp2pp, lnp2pp: L.lnp2pp, alp2ppCi95: L.alp2ppCi95 } };
  /* Fail closed on a missing interval: downstream interpolations print it
     raw ("±null" into the meta description) or crash mid-template
     (toFixed on null), and only some of them do the noisier thing. */
  if (v.alp2ppCi95 == null)
    throw new Error("headline interval missing: alp2ppCi95 is null (basis " + v.basis + ")");
  return v;
};

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

/* "The last N elections" in the meta description is the count of PAST
   federal terms the tracker has cycles for; the tagline's "since YYYY" is
   the same rows' EARLIEST year. Both are derived from the cycle-source rows
   (one key per past term; the Now term is never among them) so a new
   Past-cycles term renumbers or re-dates the copy on its own. Spelled out
   to thirty-one – the 1943-58 batch extension already sits the count
   there, and the digit fallback covers whatever comes after. */
const CYCLE_COUNT_WORDS = ["zero","one","two","three","four","five","six","seven","eight","nine","ten",
                           "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen",
                           "eighteen","nineteen","twenty","twenty-one","twenty-two","twenty-three",
                           "twenty-four","twenty-five","twenty-six","twenty-seven","twenty-eight",
                           "twenty-nine","thirty","thirty-one"];
/* Called from the tagline, the meta description and the summary table –
   ~240KB of JSON parsed once, not per call. cycle-source.json is gen-data's
   last word for the whole build, so neither can move mid-run. */
let pastCycleKeys = null;
function pastCycleRows() {
  if (pastCycleKeys == null) pastCycleKeys = Object.keys(JSON.parse(fs.readFileSync(DA("cycle-source.json"), "utf8")));
  return pastCycleKeys;
}
function pastCycleWord() {
  const n = pastCycleRows().length;
  return CYCLE_COUNT_WORDS[n] || String(n);
}
function pastCycleFirst() {
  return Math.min(...pastCycleRows().map(Number));
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
  /* the newest release by publication, the one the main page's Header
     names (gen-data's latest.newest; its url is already releaseUrl over a
     media citation), with the same "TBC" for fieldwork not yet published */
  const newest = L.newest || null;
  return { latest: { published: L.published, publishedISO: L.publishedISO, nextElectionDue: L.nextElectionDue,
                     pollsTracked: L.pollsTracked, housesTracked: L.housesTracked,
                     fact: newest ? newest.pollster + ", " + (newest.fieldPending ? "TBC" : newest.field) : null,
                     factUrl: newest ? newest.url : null,
                     // a TBC links where the fieldwork dates will appear, as on the main page
                     ...(newest && newest.fieldPending ? { factHouse: newest.pollster, factTbcUrl: newest.fieldUrl || null } : {}) },
           past: String(pastCycleFirst()), pollCadence: grab("pollCadence") };
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
/* …and the More menu's lines (2026-10-18): each menu page's headline and the
   figure it stands on, as the main page's menu shows them on load (implied
   basis, Pollster leans on Labor's main rival), so the satellites' menu
   says what the pages say. The findings are the page's own menu-lines.js,
   run here in node after the dataset and the engine exactly as the page
   runs them - one context, so the three scripts share one global scope as
   classic scripts do. A miss is a warning like the chrome's: the
   satellites' menu keeps each page's tip. */
let shellMenu = null;
try {
  const win = {};
  const ctx = vm.createContext({ window: win, React: {}, console });
  win.window = win;
  for (const f of [DA(DATASET), A("ed2260de-5b11-4bd5-8a8d-a391156c05ee.js"), A("menu-lines.js")]) {
    vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: path.basename(f) });
  }
  shellMenu = win.AP.menuLines();
} catch (e) {
  console.warn(`  site shell: menu lines missed (${e.message}) – the satellites' menu keeps each page's tip`);
}
writeAtomic(path.join(ROOT, "assets", "auspol-now.json"), JSON.stringify({ ...fav.score, dial: fav.masthead.spec, ...shellNow, ...(shellChrome ? { copy: shellChrome } : {}), ...(shellMenu ? { menu: shellMenu } : {}) }) + "\n");
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
/* The About + Reading-the-charts narrative, moved out of buildStaticSummary
   so the Info tab's static article quotes the same words (the two would
   otherwise drift in two files' worth of copies). Called with the caller's
   own L/prim/acc, so buildStaticSummary's output is unchanged. */
function ssAboutBlock(L, prim, acc) {
  return `      <h2>About this tracker</h2>
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
        the two-party result by ${acc.meanAbs} points on average &#8211; at ${accWorst(acc)}.
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
        is what the MRP tag in the archive marks.</p>`;
}

/* The Changelog tab page's static article: every entry of
   data/changelog.json (gen-data §8d, appended on each site refresh), newest
   first, as the console the retired /changelog/ satellite page introduced
   (2026-10-12) – one grid line per entry, ISO date, [kind] tag, the figures
   lit like syntax. Restored 2026-10-15 after the page's first day as a tab
   set the entries as quiet prose; the live tab renders the same console
   from D.changelog (ChangelogEntries, d1a1d215 asset – keep the two in
   step), and the .cl-* styles live in template.html. Federal only – a VIC
   build never has the file. Caller supplies its esc. */
const CL_KIND = { poll: "poll", conf: "conf", flows: "flows", finding: "finding", meta: "headline", seed: "start" };
function ssChangelogBlock(esc) {
  let C = null;
  try { C = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "changelog.json"), "utf8")); } catch { /* absent on first build */ }
  if (!C || !Array.isArray(C.entries) || !C.entries.length) return "";
  /* figures and arrows lit like syntax; esc never writes a digit, so the
     number pass can't land inside an entity it made */
  const lit = (s) => esc(s)
    .replace(/(\d[\d,]*(?:\.\d+)?%?)/g, '<span class="cl-n">$1</span>')
    .replace(/→/g, '<span class="cl-ar">→</span>');
  const newest = [...C.entries].reverse();
  const rows = newest.map((e, i) => {
    const kind = CL_KIND[e.kind] ? e.kind : "meta";
    const rep = i > 0 && newest[i - 1].date === e.date;
    return `
        <li class="cl-e cl-k-${kind}"><time class="cl-date${rep ? " cl-rep" : ""}" datetime="${esc(e.date)}">${esc(e.date)}</time><span class="cl-tag">${CL_KIND[kind]}</span><p class="cl-text">${lit(e.text)}${e.links ? e.links.map((l) => ` <a class="cl-src" href="${esc(l.url)}">${esc(l.name)}&nbsp;&#8599;</a>`).join("")
          : e.url ? ` <a class="cl-src" href="${esc(e.url)}">release&nbsp;&#8599;</a>` : ""}</p></li>`;
  }).join("");
  const n = C.entries.length;
  return `

      <section class="cl-term" aria-label="Change log entries, newest first">
        <div class="cl-bar"><span class="cl-file"><b>data/</b>changelog</span><span class="cl-live"><i aria-hidden="true"></i>recording</span></div>
        <div class="cl-body">
          <p class="cl-cmt"># ${n} ${n === 1 ? "entry" : "entries"} since ${esc(C.entries[0].date)}</p>
          <ol class="cl-log">${rows}
          </ol>
          <p class="cl-wait"><b aria-hidden="true">&#8250;</b>next entry when the next poll or confidence release lands<span class="cl-cur" aria-hidden="true"></span></p>
        </div>
      </section>
      <p class="ss-note">A poll landing is what writes most of these &#8211; the
        <a class="fb-link" href="/feed.xml">RSS feed</a> lists each new poll as it is added, with a
        link to the pollster&#8217;s own release, and <a class="fb-link" href="/allpolls/">All polls</a>
        is the interactive archive.</p>`;
}

/* The Public opinion page's static article: the payload the live page draws
   (gen-data's oneoffs-source.json, which beyond-the-vote.mjs builds from the
   one-off stores), set as text in the same topic order, so a no-JS reader or
   a crawler gets the page's findings and figures: the index of findings the
   page opens on; each topic an h2, its finding and its dek; each tracker
   its title, dek and every pollster's latest reading; each question its
   figures and pollster; each topic's further questions as a list of
   titles. One source, so the two can never disagree. No
   colour here; the .btv-ss styles are template.html's. Caller supplies its
   esc. */
const BTV_SS_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function ssBeyondBlock(esc) {
  let src = null;
  try { src = JSON.parse(fs.readFileSync(DA("oneoffs-source.json"), "utf8")); } catch { return ""; }
  if (!src || !Array.isArray(src.topics)) return "";
  const H = src.houses || {};
  const house = (h, full) => esc((H[h] || {})[full ? "full" : "short"] || h);
  const month = (iso) => BTV_SS_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
  const n = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1));
  const pct = (v) => n(v) + "%";
  const signed = (v) => (v > 0 ? "+" : v < 0 ? "&#8722;" : "") + n(Math.abs(v));
  const by = (s) => `${house(s.house, true)}, ${month(s.field.end)}`;
  const pair = (r, names) => `${pct(r.a)} ${esc(names[0])}, ${pct(r.b)} ${esc(names[1])}${r.sig === false ? " (level)" : ""}`;
  const block = (c) => {
    if (c.kind === "tracker") {
      const latest = c.panels.map((p) => {
        const q = p.points[p.points.length - 1];
        return `<li>${house(p.house, true)}, ${month(q.field.end)}: ${c.measure === "net" ? "net " + signed(q.v) + " (" + pct(q.a) + " " + esc(c.names[0]) + ", " + pct(q.b) + " " + esc(c.names[1]) + ")" : pct(q.v) + " " + esc(c.names[0])}</li>`;
      }).join("");
      return `
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.dek)}</p>
        <ul class="btv-ss-list">${latest}</ul>`;
    }
    if (c.kind === "split") return `
        <h3>${esc(c.title)}</h3>
        <p>${pair(c, c.names)}. <span class="btv-ss-by">${by(c.src)}</span></p>`;
    if (c.kind === "stack") return `
        <h3>${esc(c.title)}</h3>
        <ul class="btv-ss-list">${c.rows.map((r) => `<li>${r.label ? esc(r.label) : house(r.src.house) + ", " + month(r.src.field.end)}${r.wording ? " (" + esc(r.wording) + ")" : ""}: ${pair(r, c.names)}</li>`).join("")}</ul>${c.summary ? `
        <p>${esc(c.summary)}</p>` : ""}`;
    if (c.kind === "rank" || c.kind === "nets") return `
        <h3>${esc(c.title)}</h3>
        <ul class="btv-ss-list">${c.rows.map((r) => `<li>${esc(r.label)}: ${c.kind === "nets" ? signed(r.v) : pct(r.v)}</li>`).join("")}</ul>
        <p><span class="btv-ss-by">${esc(c.base || c.unit || "")}${c.base || c.unit ? ". " : ""}${by(c.src)}</span></p>`;
    return "";
  };
  const shown = src.topics.filter((t) => t.blocks.length || t.more.length);
  /* the index the live page opens on: each topic's finding, as text */
  const findings = shown.filter((t) => t.finding).map((t) => `<li><b>${esc(t.short)}:</b> ${esc(t.finding.text)}. <span class="btv-ss-by">${esc(t.finding.meta)}</span></li>`).join("");
  const sections = shown.map((t) => `
      <h2>${esc(t.title)}</h2>${t.finding ? `
      <p><b>${esc(t.finding.text)}.</b> <span class="btv-ss-by">${esc(t.finding.meta)}</span></p>` : ""}
      <p class="btv-ss-dek">${esc(t.dek)}</p>
${t.blocks.map(block).join("")}${t.more.length ? `
        <h3>More questions on ${esc(t.short.charAt(0).toLowerCase() + t.short.slice(1))}</h3>
        <ul class="btv-ss-list">${t.more.map((q) => `<li>${esc(q.title)} <span class="btv-ss-by">(${house(q.house)}, ${month(q.last)})</span></li>`).join("")}</ul>` : ""}`).join("");
  return `

      <section class="btv-ss" aria-label="Public opinion: the questions by topic">
      <h2>The findings</h2>
      <ol class="btv-ss-list">${findings}</ol>${sections}
      </section>`;
}

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
      <p class="ss-sub">Aggregated opinion polling for the next Australian federal election, and for all since ${pastCycleFirst()}.
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
           Its ± is a margin of two parts, the polls' sampling error and the
           flow table's own range, and its basis is the first-principles set,
           not the 2025 flows – the sentence has to say both, since the
           classic pair above is. */
      L.onImp ? `<p>Against One Nation the implied reading is
        <b>Labor ${L.onImp.a.toFixed(1)}%</b>, <b>One Nation ${L.onImp.b.toFixed(1)}%</b>
        (&#177;${(L.onImp.ci95 != null ? L.onImp.ci95 : L.onImp.band).toFixed(1)}, counting both the polls&#8217;
        sampling error and doubt about the flow table). No election
        night has ever counted a Labor v One Nation finish, so that figure runs on the
        site&#8217;s own estimated preference flows rather than the 2025
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

${ssAboutBlock(L, prim, acc)}

      <h2>Sources</h2>
      <p>${esc(sources)}. Field dates and sample sizes are listed per poll in the archive.</p>

      <p class="ss-note" data-nosnippet>auspol tracker is an unofficial aggregator of published federal opinion polling.
        Best efforts are made to make the aggregate figures transparent, trustworthy, statistically
        sound, and informative, but they are, in the end, estimates only. Federal polling archives
        I&#8217;ve located are stored <a href="https://auspoltracker.com/provenance/">here</a> for
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

/* The worst final-polls miss, as the static copy quotes it. "Every house on
   the same side" only when two or more houses polled and all missed one way
   (gen-data's sameSide); a lone house is named instead, since one poll
   always misses one way. */
function accWorst(acc) {
  const w = acc.worstCycle, by = `${w.year} by ${Math.abs(w.err)}`;
  if (w.n === 1) return `${by}, when ${w.houses[0].firm} was the only pollster`;
  return w.sameSide ? `${by}, with every house on the same side of it` : by;
}

/* ---- the tab pages' static articles ------------------------------------
   Each tab is also its own URL (Now is the root document; the rest one
   segment under it), and a crawler or no-JS reader landing on one should
   read that tab's subject, not the front page's. These articles fill their
   documents' STATIC_SUMMARY slot; every fact is read back from the same
   generated dataset as the Now summary, so a tab page can never quote
   figures the root page hasn't published. */
function tabSummaryFacts() {
  const src = fs.readFileSync(DA(DATASET), "utf8");
  const grab = (name) => {
    const i = src.indexOf("const " + name + " = ");
    if (i < 0) throw new Error("tab summary: " + name + " not found");
    return JSON.parse(src.slice(i + name.length + 9, src.indexOf("\n", i)).replace(/;$/, ""));
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const L = headlineView(grab("latest"), grab("synthLatest"));
  const polls = grab("individualPolls"), table = grab("pollsterTable"), acc = grab("accuracy");
  const counts = {};
  polls.forEach((p) => { counts[p.pollster] = (counts[p.pollster] || 0) + 1; });
  const sources = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).join(", ");
  const latestRows = table.slice(0, 6).map((r) => `
        <tr>
          <th scope="row">${esc(r.pollster)}</th>
          <td>${esc(r.field)}</td>
          <td>${r.sample ? r.sample.toLocaleString("en-AU") : "&#8211;"}</td>
          <td>${r.alpImp != null ? r.alpImp.toFixed(1) + "%" : "&#8211;"}</td>
          <td>${r.alpImp != null ? (100 - r.alpImp).toFixed(1) + "%" : "&#8211;"}</td>
        </tr>`).join("");
  return { esc, L, prim: L.primary, polls, acc, sources, latestRows, grab };
}

/* The closing pair every static article ends with: the Sources block and
   the estimates-only note (the wording the Now and Vic summaries carry). */
function ssTail(esc, sources) {
  return VIC
    ? `<h2>Sources</h2>
      <p>${esc(sources)}. Field dates and sample sizes are listed per poll in the archive.</p>

      <p class="ss-note" data-nosnippet>${esc(JV.brand)} tracker is an unofficial aggregator of published ${esc(JV.adj)} opinion polling,
        part of <a href="${SITE_URL}">auspol tracker</a>. The figures are estimates only.</p>`
    : `<h2>Sources</h2>
      <p>${esc(sources)}. Field dates and sample sizes are listed per poll in the archive.</p>

      <p class="ss-note" data-nosnippet>auspol tracker is an unofficial aggregator of published federal opinion polling.
        Best efforts are made to make the aggregate figures transparent, trustworthy, statistically
        sound, and informative, but they are, in the end, estimates only. Federal polling archives
        I&#8217;ve located are stored <a href="https://auspoltracker.com/provenance/">here</a> for
        safekeeping and convenience.</p>`;
}

function buildTabSummary(id) {
  const { esc, L, prim, acc, sources, latestRows, grab } = tabSummaryFacts();
  if (id === "cycles") {
    const els = Object.values(DATA.elections).sort((a, b) => a.date.localeCompare(b.date));
    /* "Won by" is the side that formed government – the term the election
       opened – not the 2PP majority: 1954, 1961, 1969, 1990 and 1998 went
       to the side that lost the two-party vote. The 2PP stands as the
       fallback only for an election no cycle row covers. */
    const govOf = new Map(grab("CYCLE_DEFS").map((c) => [String(c.year), c.gov]));
    const eRows = els.map((E) => `
        <tr>
          <th scope="row">${E.date.slice(0, 4)}</th>
          <td>${(govOf.get(E.date.slice(0, 4)) ?? (E.tpp_alp >= 50 ? "alp" : "lnp")) === "alp" ? "Labor" : "Coalition"}</td>
          <td>${E.tpp_alp.toFixed(1)}%</td>
          <td>${E.tpp_lnp.toFixed(1)}%</td>
        </tr>`).join("");
    const firstY = els[0].date.slice(0, 4), lastY = els[els.length - 1].date.slice(0, 4);
    return `<article class="static-summary">
      <h1>Past election cycles</h1>
      <p class="ss-sub">${VIC ? "Victorian" : "Australian federal"} opinion polling set against history: every election
        cycle's polling charted month by month, beside the result the campaign ended in. The current
        campaign is on the <a href="${PAGE_URL}">front page</a>.</p>

      <h2>Election results</h2>
      <p class="ss-cap" id="ss-cyc-cap">${VIC ? "State" : "Federal"} election results, ${firstY}&#8211;${lastY} &#8211; the
        base today's polls are measured against, and the final reading of each past cycle's charts.</p>
      <div class="ss-tblwrap">
      <table class="ss-table" aria-labelledby="ss-cyc-cap">
        <thead><tr><th scope="col">Election</th><th scope="col">Won by</th><th scope="col">ALP 2PP</th><th scope="col">L/NP 2PP</th></tr></thead>
        <tbody>${eRows}
        </tbody>
      </table>
      </div>
${acc ? `
      <h2>How the final polls have done</h2>
      <p>Measured against the ${acc.cycles.length} elections from ${acc.cycles[0].year} to
        ${acc.cycles[acc.cycles.length - 1].year}, the final polls missed the two-party result by
        ${acc.meanAbs} points on average &#8211; at ${accWorst(acc)}. The full record, house by house and
        cycle by cycle, is tabled on the live page.</p>
` : ""}
${ssTail(esc, sources)}
    </article>`;
  }
  if (id === "allpolls") {
    return `<article class="static-summary">
      <h1>All polls</h1>
      <p class="ss-sub">Every published ${esc(VIC ? JV.adj : "Australian federal")} opinion poll since the
        ${VIC ? `${DATA.elections[JV.baseline].date.slice(0, 4)} Victorian` : "May 2025 federal"} election &#8211;
        ${L.pollsTracked} polls from ${L.housesTracked} polling houses, most recently
        <time datetime="${esc(L.updatedISO)}">${esc(L.updated)}</time>. The live page filters them by house,
        measure and fieldwork date; each wave's full published ledger opens from its row.</p>

      <h2>Latest polls</h2>
      <p class="ss-cap" id="ss-tab-polls-cap">Most recent published ${esc(VIC ? JV.adj : "national")} polls &#8211; the
        two-party figures read each poll&#8217;s primaries at the same preference flows, so the table
        compares house to house on one fixed allocation.</p>
      <div class="ss-tblwrap">
      <table class="ss-table" aria-labelledby="ss-tab-polls-cap">
        <thead><tr><th scope="col">Pollster</th><th scope="col">Fieldwork</th><th scope="col">Sample</th><th scope="col">ALP 2PP</th><th scope="col">L/NP 2PP</th></tr></thead>
        <tbody>${latestRows}
        </tbody>
      </table>
      </div>

      <h2>About the archive</h2>
      <p>There is one row per published wave &#8211; never modelled or interpolated &#8211; and month rows
        average the waves whose fieldwork closed within them. A &#8220;&#8212;&#8221; in any column means
        the pollster didn&#8217;t ask that question. Primary votes, two-party figures, leadership
        ratings and each poll&#8217;s links to its source release are all carried on the row.</p>

${ssTail(esc, sources)}
    </article>`;
  }
  /* flows-explained (the ☰ menu's fourth page, 2026-10-15): the explainer
     itself. Its static article IS the article, head and sub included – every
     other tab's static slot is a proxy for live charts, but this page's
     content is prose, and a crawler or no-JS reader gets the whole of it.
     The body is explained-article.html verbatim: the same string the client
     renders as window.EXPLAINED_ARTICLE – one file, two consumers. The
     dated corrections folded into the prose live in that file's comment. */
  if (id === "flows-explained") {
    const body = fs.readFileSync(path.join(HERE, "explained-article.html"), "utf8");
    return `<article class="static-summary">
      <h1>Preference flows explained</h1>
      <p class="ss-sub">There are two ways to get a two-party figure from a poll. The pollster can ask respondents which of the final two they would rank higher, or apply its own assumptions, and publish the result. Or the poll&#8217;s first preferences can be run through one fixed table of preference flows, the same for every pollster. That implied figure is the default here: it moves only when voters do, never with a pollster&#8217;s change of method, and at past elections it has had the better record. Below: how each works, why the implied figure leads, and where the table&#8217;s numbers come from.</p>

      <div class="ex-body">
${body.trim()}
      </div>
    </article>`;
  }
  /* the ☰ menu's fifth page, Public opinion: the questions the pollsters
     ask beyond voting intention, by topic (ssBeyondBlock); the live tab draws
     the same payload as findings, charts and rows (RdBeyond, rd-beyond.jsx). Federal
     only – /vic/'s menu never holds it */
  if (id === "public-opinion") {
    /* the topic count the live dek states (gen-data's beyondTopics, counted
       the way the page's own topic list counts) */
    let topics = null;
    try { topics = JSON.parse(fs.readFileSync(DA("oneoffs-source.json"), "utf8")).topics.filter((t) => t.blocks.length || t.more.length).length; } catch {}
    return `<article class="static-summary">
  <h1>Public opinion</h1>
  <p class="ss-sub">Voting intention is only part of what the pollsters ask. This page
    gathers the rest of this term&#8217;s questions worth knowing${topics ? ", in " + (CYCLE_COUNT_WORDS[topics] || topics) + " topics" : ","} from
    Donald Trump and immigration to the budget, the Iran war and the Bondi attack. Each
    opens with what the polls found; where several pollsters asked the same thing, their
    answers sit side by side, and every figure names its pollster and links to its source.</p>

${ssBeyondBlock(esc)}

  ${ssTail(esc, sources)}
</article>`;
  }
  /* the ☰ menu's pages: what each measures, in words; the figures are the
     live page's charts */
  const MENU_SS = {
    disagreement: ["Poll disagreement",
      `How far the polls sit from the trend through them, month by month, set against the spread
        sampling error alone would leave. Polls that scatter more widely than that disagree for
        reasons beyond chance &#8211; method, timing or a real shift; polls that sit closer than it
        may be leaning on one another. The live page charts the two-party and primary-vote measures.`],
    leans: ["Pollster leans",
      `How each pollster leans: its polls against the other houses polling within weeks of them,
        pooled with recent polls counting for more, and shrunk toward zero while a house has published
        few. The aggregate subtracts each lean as it stood at the time. The live page charts every
        house's lean month by month, on the two-party figure and on each party's primary vote.`],
    flows: ["Respondent-allocated preference flows",
      `Where minor-party preferences are flowing now. The two-party figures read every poll's
        primaries through the flows counted at the last election; this page checks whether voters
        are still sending their preferences that way &#8211; what they tell pollsters when asked to
        choose between the final two, and what the pollsters' own two-party figures imply &#8211; one
        contest at a time.`],
  };
  // the change log's own menu page: every entry of data/changelog.json as the
  // console the retired satellite page introduced (ssChangelogBlock); the
  // static list IS the page for a no-JS reader or crawler (the client renders
  // the same entries live, ChangelogEntries in the d1a1d215 asset)
  if (id === "changelog") {
    return `<article class="static-summary">
  <h1>Changelog</h1>
  <p class="ss-sub">What has moved the aggregate&#8217;s two-party preferred estimate, and when each
    statistical finding appeared or fell away, as well as the four economic-confidence gauges
    &#8211; recorded entry by entry as new readings land.</p>

${ssChangelogBlock(esc)}

  ${ssTail(esc, sources)}
</article>`;
  }

  if (MENU_SS[id]) {
    const [h1, sub] = MENU_SS[id];
    return `<article class="static-summary">
      <h1>${h1}</h1>
      <p class="ss-sub">${sub} The latest figures are on the <a href="${PAGE_URL}">front page</a>.</p>

${ssTail(esc, sources)}
    </article>`;
  }
  /* info */
  return `<article class="static-summary">
      <h1>About ${VIC ? JV.brand : "auspol"} tracker</h1>
      <p class="ss-sub">How the aggregate is made: the weighting and house-lean method, the pollsters it
        tracks, and the terms the site uses.</p>

${VIC ? `      <h2>About this tracker</h2>
      <p>${esc(JV.brand)} tracker pools every published ${esc(JV.adj)} voting-intention poll of the current
        term. The two-party and primary-vote lines are smoothed trends through every poll this term, each
        poll counted by its sample and adjusted for its pollster&#8217;s lean against the other houses
        polling around it, shrunk toward zero while the evidence is thin. The implied two-party reading
        reallocates every poll&#8217;s primaries at ${esc(JV.flowsLabel)}, so every poll that publishes
        primaries counts, not only those that file a two-party figure. Leadership ratings and preferred
        premier are plain published readings. It is part of
        <a href="${SITE_URL}">auspol tracker</a>, the federal poll aggregate.</p>
      <p>The live page&#8217;s Info tab defines the terms both sites use &#8211; two-party preferred,
        implied flows, house lean, the preference-flow machinery and the rest &#8211; and links every
        pollster&#8217;s series and methodology statement.</p>
` : ssAboutBlock(L, prim, acc)}

${ssTail(esc, sources)}
    </article>`;
}

if (!html.includes("<!--STATIC_SUMMARY-->")) throw new Error("STATIC_SUMMARY marker not found in template");
html = html.replace("<!--STATIC_SUMMARY-->", "\n    " + (VIC ? buildStaticSummaryVic() : buildStaticSummary()) + "\n  ");

/* The share card carries live figures, so it can be WRONG in a way the old
   generic one could not. build.mjs cannot draw it - there is no rasteriser
   here; make-card.js builds it inside the page and render-card.mjs
   photographs it - but it can refuse to let a stale one pass unremarked, and
   it can stop scrapers serving a cached old card once a new one exists. What
   the card was drawn for is recorded beside it; ?v= makes every redraw a new
   URL as far as a scraper is concerned, because they key their caches on the
   full URL.

   The stamp's date and the date the card prints are both publishedISO, the
   newest poll's publication; it rides in the fig block with everything else
   the scoreboard shows. The fieldwork end (updatedISO) stays off the card -
   a weekly house's fieldwork closes the day before it drops, so the card
   would always read a day stale. It remains what the hero's "updated"
   prints. */
/* The contest the card quotes. The card draws Labor against the rival the
   site leads with - gen-data's rivalLead, the margin-gated ruling over the
   implied series that also picks the hero's contest and the favicon's
   needle. When that rival is One Nation the figures are latest.onImp's
   (the pairing's only quoted level; its ± is the margin of the polls'
   sampling interval and the flow table's range), and the pollsters' published head-to-heads the
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
  /* the ladder's margins: the latest month's 95% intervals, as the
     primary-vote panel's level test reads them */
  const AP = grab("aggPrimary");
  const hv = { ...headlineView(L, S), primCi: (AP[AP.length - 1] || {}).ci || {} };
  const onImp = L.onImp && L.onImp.a != null ? L.onImp : null;
  const onPub = alt && alt.alp_on && alt.alp_on.a != null ? alt.alp_on : null;
  if (L.rivalLead !== "alp_on" || (!onImp && !onPub))
    return { ...hv, vs: "lnp", oppLab: "Coalition" };
  const s = onImp || onPub;
  return { ...hv, vs: "onp", oppLab: "One Nation",
           alp2pp: s.a, lnp2pp: s.b,
           alp2ppCi95: onImp ? (s.ci95 != null ? s.ci95 : s.band) : s.ci95,
           alp2ppPrev: s.aPrev, changeSig: !!s.changeSig,
           method: { ...hv.method, nPolls: s.n },
           basis: onImp ? "imp" : "pub" };
}
/* The card's figure block: everything the scoreboard prints, in exactly the
   shape and key order make-card.js stamps into assets/auspol-card.json –
   mirror any change in both files. The two-party score and its verdict, the
   month's move, the basis, the date, the ladder's inputs (the five
   primaries and their margins, slash-joined in CARD_IDS order), and the
   next election's latest date, which sets the month's /N; the places and
   ties follow from those. Written out as a machine-readable sidecar so
   render-card's staleness gate (and any future consumer) reads it here
   instead of string-splitting the dataset asset the way grabLatest does. */
const CARD_IDS = ["alp", "lnp", "grn", "onp", "oth"];
/* The card's design, last in the block: a hash of make-card.js and its face,
   so a redesign redraws the card and moves the og:image ?v= key even when no
   figure has moved. render-card.mjs adds it to the stamp from the same two
   files (make-card.js itself can't see its own source). */
const CARD_DESIGN = crypto.createHash("sha1")
  .update(fs.readFileSync(path.join(HERE, "make-card.js")))
  .update(fs.readFileSync(path.join(HERE, "fonts", "doto-card.woff2")))
  .digest("hex").slice(0, 8);
function cardFigs(L) {
  return { vs: L.vs, alp: L.alp2pp.toFixed(1), lnp: L.lnp2pp.toFixed(1),
           ci: L.alp2ppCi95.toFixed(1),
           mom: (L.alp2pp - (L.alp2ppPrev != null ? L.alp2ppPrev : L.alp2pp)).toFixed(1),
           sig: !!L.changeSig,
           basis: L.basis,
           date: L.publishedISO,
           prim: CARD_IDS.map((id) => (L.primary[id] != null ? L.primary[id].toFixed(1) : "-")).join("/"),
           pci: CARD_IDS.map((id) => (L.primCi[id] != null ? (+L.primCi[id]).toFixed(1) : "-")).join("/"),
           due: L.nextElectionDue || "",
           design: CARD_DESIGN };
}
/* The scoreboard in words, for og:image:alt, built from a fig block so the
   alt can follow whichever card was drawn. The verdict and the ladder's
   level groups are make-card.js's, in sentences: a lead no bigger than its
   margin is too close to call, and a party joins the group above it while
   the gap to that group's first party is inside their margins combined. */
function cardAltOf(f, stampISO) {
  const NAME = { alp: "Labor", lnp: "Coalition", grn: "Greens", onp: "One Nation", oth: "Others" };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
                  "September", "October", "November", "December"];
  const rival = f.vs === "onp" ? "One Nation" : "Coalition";
  const lead = +(f.alp - f.lnp).toFixed(1), margin = +(2 * f.ci).toFixed(1);
  const who = lead > 0 ? "Labor" : rival, by = Math.abs(lead).toFixed(1), pm = "±" + margin.toFixed(1);
  const verdict = Math.abs(lead) > margin ? `${who} ahead by ${by}, outside the ${pm} margin`
    : lead ? `too close to call, ${who}\u2019s ${by}-point lead inside the ${pm} margin`
    : `level, inside the ${pm} margin`;
  const [y, m, d] = String(f.date || stampISO || "").split("-").map(Number);
  const when = d ? ` for ${d} ${MONTHS[m - 1]} ${y}` : "";
  let ladder = "";
  if (f.prim && f.pci) {
    const v = f.prim.split("/"), c = f.pci.split("/");
    const rows = CARD_IDS.map((id, i) => ({ id, v: +v[i], ci: +c[i] || 0 }))
      .filter((r) => !Number.isNaN(r.v)).sort((p, q) => q.v - p.v);
    const groups = [];
    rows.forEach((r) => {
      const g = groups[groups.length - 1];
      if (g && g[0].v - r.v < Math.hypot(g[0].ci, r.ci)) g.push(r); else groups.push([r]);
    });
    const list = (a) => a.length < 3 ? a.join(" and ") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
    ladder = " First preferences: " + groups.map((g) => list(g.map((r) => `${NAME[r.id]} ${r.v.toFixed(1)}`))
      + (g.length > 1 ? ", level inside the margin" : "")).join("; ") + ".";
  }
  return `auspol tracker scoreboard${when}. Two-party preferred${f.basis === "imp" ? " on implied preference flows" : ""}: `
    + `Labor ${f.alp}, ${rival} ${f.lnp}, ${verdict}.${ladder}`;
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
/* PNG, not WebP: several social/chat crawlers (Slack, LinkedIn, older
   Discord clients, some verification bots) reject WebP og:images outright
   and fall back to a blank card. The ~35 KB saved isn't worth a conservative
   render for those embeds. WebP could ride parallel og:image entries once
   verified across every consumer of the share card. */
/* The card carries figures, so its alt says them. Someone who cannot see the
   preview should get the same reading from it. The card a crawler fetches is
   the committed PNG, drawn for cardStamp – on the warn-only path above that
   stays an older wave while the data has moved on, so derive the alt from the
   DRAWN stamp's fig block (assets/auspol-card.json) when it didn't draw
   today's wave, and the alt and the pixels always agree. */
const cl = cardContest();
const cardAlt = cardStamp && cardStamp !== dataStamp && cardFigsDrawn
  ? cardAltOf(cardFigsDrawn, cardStamp) : cardAltOf(cardFigs(cl));
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
/* "As of" is the newest poll's PUBLICATION day (the same date make-card
   prints and cardAlt quotes), not the fieldwork end the hero shows: an
   embed that showed the fieldwork end beside the card would read a day
   stale. */
const metaDesc = VIC
  ? `${JV.brand} tracker averages every published ${JV.adj} state opinion poll. `
    + `As of ${hl.published}, ${raceLine(hl).replace(/^The /, "the ")} two-party preferred${basisClause(hl)} (±${hl.alp2ppCi95}), `
    + `from ${hl.pollsTracked} polls by ${hl.housesTracked} pollsters. Election day: ${hl.nextElectionDue}.`
  : `auspol tracker averages every published Australian federal opinion poll. `
  + `As of ${hl.published}, ${raceLine(hl).replace(/^The /, "the ")} two-party preferred${basisClause(hl)} (±${hl.alp2ppCi95}), `
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

/* /vic/ is a document of THIS site, with its own brand name: a WebPage node
   whose isPartOf names the federal WebSite, so crawlers file Vicpol under
   auspol tracker rather than inventing a second site. Reuses JV (defined
   beside metaDesc) so the words can't drift. A GENERATOR, not one block:
   every tab document swaps its own name/url/desc in beside its canonical,
   or all six pages would claim the root page's identity. */
const vicPageJsonLdFor = (name, url, desc) => `<script type="application/ld+json">${
  JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    url,
    description: desc,
    inLanguage: "en-AU",
    isPartOf: { "@type": "WebSite", name: "auspol tracker", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "auspol tracker",
      url: SITE_URL,
    },
  }).replace(/</g, "\\u003c")
}</script>`;
const vicPageJsonLd = VIC
  ? vicPageJsonLdFor(`${JV.brand} tracker – ${JV.electionWords} election polling`, PAGE_URL, metaDesc) : "";

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
  ${/* Googlebot-Image and iOS home-screen need a raster icon and can't read
      the data-URI SVG below; the committed PNG is the site's brand icon, so
      /vic/ carries it too. favPng is !VIC-gated for the federal head below,
      so the Vic branch tests the disk itself. */""}
  ${fs.existsSync(FAV_PNG) ? `<link rel="icon" type="image/png" sizes="192x192" href="${SITE_URL}assets/favicon-192.png">
  <link rel="apple-touch-icon" href="${SITE_URL}assets/favicon-192.png">
  ` : ""}<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${favicon}">
  ${fontLinks.join("\n  ")}
  ${vicPageJsonLd}`
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
  <meta name="twitter:image" content="${cardUrl}">
  <meta name="twitter:image:alt" content="${cardAlt}">
  <meta name="google-site-verification" content="sUMvJK3smMtuRAQNZiu9yW3FPS5rD4XI_eod7Dc6k5g">
  <meta name="theme-color" content="${THEME_LIGHT}" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="${THEME_DARK}" media="(prefers-color-scheme: dark)">
  <link rel="canonical" href="${SITE_URL}">
  <link rel="alternate" type="application/rss+xml" title="auspol tracker – new polls" href="${SITE_URL}feed.xml">
  ${favPng ? `<link rel="icon" type="image/png" sizes="192x192" href="${SITE_URL}assets/favicon-192.png">
  ` : ""}${/* iOS scales the 192 to its 180 home-screen slot, and the PNG is
      opaque, which a touch icon must be (iOS composites transparency onto
      black) — so the one file serves both slots and the touch icon rides
      render-favicon.mjs's staleness gate. */""}
  ${favPng ? `<link rel="apple-touch-icon" href="${SITE_URL}assets/favicon-192.png">
  ` : ""}<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${favicon}">
  ${fontLinks.join("\n  ")}
  ${websiteJsonLd}`);

/* The one <title>/og:title string every document on this page carries –
   the tab pages swap their own in for it below. */
const FED_TITLE = "auspol tracker – Australian federal election polling";
const BASE_TITLE = VIC ? `${JV.brand} tracker – ${JV.electionWords} election polling` : FED_TITLE;
if (VIC) {
  html = html.replace(`<title>${FED_TITLE}</title>`, `<title>${BASE_TITLE}</title>`)
    .replace(`<meta property="og:title" content="${FED_TITLE}">`, `<meta property="og:title" content="${BASE_TITLE}">`);
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
/* Absolute, not "assets/…": the tab pages sit a folder down from the root
   document, and the browser resolves the cycle-source fetch against the
   page's own URL. */
parts.push(`<script>window.AP_CYCLE_SRC=${VIC ? "null" : JSON.stringify("/assets/" + cycleSrcName)};<\/script>`);
/* The questions behind the ☰ menu's Public opinion page get the same
   treatment as the cycle-source rows: a hashed sidecar outside the main
   payload (nobody but that page's reader needs it), gen-data's
   oneoffs-source.json shipped to /assets/ under its own content hash; the
   client prefetches it at idle so the tab renders on the spot. */
const oneOffsJson = !VIC && fs.readFileSync(DA("oneoffs-source.json"), "utf8");
if (!VIC) {
  const name = `oneoffs-source.${hash8(Buffer.from(oneOffsJson))}.json`;
  for (const old of fs.readdirSync(path.join(ROOT, "assets"))) {
    if (/^oneoffs-source\..*\.json$/.test(old) && old !== name)
      fs.unlinkSync(path.join(ROOT, "assets", old));
  }
  writeAtomic(path.join(ROOT, "assets", name), oneOffsJson);
  parts.push(`<script>window.AP_ONEOFF_SRC=${JSON.stringify("/assets/" + name)};<\/script>`);
} else parts.push(`<script>window.AP_ONEOFF_SRC=null;<\/script>`);
/* The explainer's article, shipped to every federal document so the ☰ menu's
   flows-explained tab renders on an instant client-side swap like its
   siblings (tab clicks never fetch). One source: the string here and the
   static article of the /flows-explained/ document (buildTabSummary) are the
   same file. /vic/ has no explainer tab and ships no copy. */
/* Every layer beyond the two per-document constants above ships as a hashed
   EXTERNAL file, not an inline script. The app used to ride inside the
   document – 3.9MB of JS repeated in every one of the nine tab documents,
   re-downloaded and re-parsed by every visitor every time a single poll row
   moved the dataset. Each layer is now a file of its own under assets/js/,
   named by a hash of its own bytes like the fonts, the cycle source and the
   one-offs sidecar: the classic parser-blocking <script src> tags execute in
   exactly the order the inlined blocks did, with the same one-global-scope
   semantics (nothing reads a comment or a sourceURL out of the built page);
   the preload scanner fetches the whole set in parallel as the shell HTML
   arrives; and a data refresh re-downloads only data.<hash>.js plus the
   small document shells instead of the whole application.
   DATASET's base carries the jurisdiction (data / data-vic) so a /vic/ build
   never sweeps the federal dataset file, and the GC below deletes only
   prefixes this build itself writes – it leaves the other jurisdiction's
   data file alone, exactly like the cycle-source sweep above.
   The external bytes are NOT inlineJs-escaped: that escape exists only to
   keep a literal "</script" out of an inline block, and applied to a file it
   would corrupt the string. */
const JS_DIR = path.join(ROOT, "assets", "js");
fs.mkdirSync(JS_DIR, { recursive: true });
const jsKeep = new Set();
const jsBases = [];
const emitJs = (base, code) => {
  const name = `${base}.${hash8(Buffer.from(code, "utf8"))}.js`;
  jsKeep.add(name);
  if (!jsBases.includes(base)) jsBases.push(base);
  writeAtomic(path.join(JS_DIR, name), code);
  return `<script src="assets/js/${name}"></script>`;
};
if (!VIC) parts.push(emitJs("explained", `window.EXPLAINED_ARTICLE=${JSON.stringify(fs.readFileSync(path.join(HERE, "explained-article.html"), "utf8"))};`));
for (const f of ["react.production.min.js", "react-dom.production.min.js"])
  parts.push(emitJs(f.replace(/\.production\.min\.js$/, ""), fs.readFileSync(path.join(HERE, "vendor", f), "utf8")));
for (const f of PLAIN) {
  if (f !== DATASET) {
    parts.push(emitJs(f.replace(/\.js$/, ""), stripJs(fs.readFileSync(A(f), "utf8"), f)));
    continue;
  }
  const src = fs.readFileSync(DA(f), "utf8");
  const { main, late } = splitDataset(src);
  const out = stripJs(jsonParseLiterals(main), f);
  /* the JSON.parse form plus the late half must build exactly the dataset the
     literals did (keys compared sorted: a merged poll carries its late fields
     last, and nothing reads a poll's keys in order) */
  const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === "object"
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
  const run = (...codes) => { const ctx = vm.createContext({ window: {} }); for (const c of codes) vm.runInContext(c, ctx); return JSON.stringify(sorted(ctx.window.AUSPOL)); };
  if (run(out, late) !== run(src)) throw new Error("dataset: the split or the JSON.parse literals changed window.AUSPOL");
  parts.push(emitJs(VIC ? "data-vic" : "data", out));
  parts.push(emitJs(VIC ? "data-vic-late" : "data-late", late));
}
/* A module carrying a "@late-split" comment ships in two files: the code
   above the marker (what the first screen runs) under its own name, the rest
   as <name>-late, which LATE_MODULES sends after the first paint. Both are
   classic scripts in one global scope, so the halves see each other exactly
   as the one file's top level did; tab documents load both, in order. */
const LATE_SPLIT = /\n\/\* @late-split\b[\s\S]*?\*\/\n/;
for (const f of JSX) {
  const base = f.replace(/\.jsx?$/, "");
  const code = fs.readFileSync(A(f), "utf8");
  const cut = code.match(LATE_SPLIT);
  if (!cut) { parts.push(emitJs(base, transpile(code, f))); continue; }
  parts.push(emitJs(base, transpile(code.slice(0, cut.index), f)));
  parts.push(emitJs(base + "-late", transpile(code.slice(cut.index + cut[0].length), f)));
}
/* a hashed name changes when the bytes do, so sweep the ones nothing points
   at – but only names whose base this build owns (the jurisdiction sweep
   above is why explained/data.* survive a /vic/ build) */
{
  let swept = 0;
  for (const old of fs.readdirSync(JS_DIR)) {
    if (!/\.[0-9a-f]{8}\.js$/.test(old)) continue;
    const base = old.replace(/\.[0-9a-f]{8}\.js$/, "");
    if (!jsBases.includes(base) || jsKeep.has(old)) continue;
    fs.unlinkSync(path.join(JS_DIR, old));
    swept++;
  }
  if (swept) console.log(`  + assets/js · swept ${swept} stale hashed file(s)`);
}

/* Splice the script tags in at an explicit marker.
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
/* /vic/ sits one folder down: the shared fonts and the hashed js files are
   site-root assets. Relative, never /assets/…: a saved file:// copy must
   still boot, and an absolute path resolves to the filesystem root there. */
if (VIC) html = html.replace(/href="assets\//g, 'href="/assets/').replace(/url\("assets\//g, 'url("/assets/').replace(/src="assets\//g, 'src="../assets/');

/* Every <script src> a document keeps is also announced in <head> as a
   preload. The tags sit at the foot of the body, behind ~490KB of inline CSS
   and the static article, so the preload scanner met them only once the
   whole document had arrived (~1.2s into a slow-4G load); announced up top,
   they download while the document is still streaming. Same URLs as the
   tags, so each response is the one its tag runs: slow 4G 3.22 -> 3.04s,
   3G-like 6.61 -> 6.27s to the app on screen (390px, 4x CPU). */
const withScriptPreloads = (doc) => {
  const srcs = [...doc.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  /* after the font preloads, not before: listed first, the scripts took the
     bandwidth and the faces landed ~220ms after the app on a cold fast-4G
     visit - the text painted in the fallback, swapped, and the charts
     re-measured (textWidth). The faces are ~80KB; ahead of the scripts they
     are in by the first paint. */
  const fontAt = doc.lastIndexOf('as="font"');
  const at = fontAt < 0 ? doc.indexOf('<link rel="preload"') : doc.indexOf("\n", fontAt) + 1;
  if (at <= 0 || !srcs.length) return doc;
  const tags = srcs.map((u) => `<link rel="preload" href="${u}" as="script">`);
  return fontAt < 0 ? doc.slice(0, at) + tags.map((t) => t + "\n  ").join("") + doc.slice(at)
    : doc.slice(0, at) + tags.map((t) => "  " + t + "\n").join("") + doc.slice(at);
};
/* ---- 5a. every tab is also its own page --------------------------------
   The tabs are one document's views of the same data, but a URL each lets
   the archive, the past cycles and the method page be linked, crawled and
   shared. Each of these documents is the root document with its own title,
   description, canonical and static article, plus window.AP_INITIAL_TAB so
   the client opens straight into the named tab. Nothing is added to the
   Now document: absent the constant, the client defaults to Now, so the
   build's root output is identical with or without these pages. */
{
  const BASE_DIR = path.dirname(OUT);
  /* /vic/ has no past terms in its cycle data, so its client renders no
     Past cycles tab and this page must not exist either; it appears once
     the data records an election older than the term-opening baseline. */
  const pastTab = !VIC || Object.keys(DATA.elections || {}).some((k) => k !== DATA.jurisdiction.baseline);
  const BRAND = VIC ? JV.brand : "auspol";
  const tabs = [
    ...(pastTab ? [{ id: "cycles", label: "Past cycles",
      desc: `${VIC ? "Victorian" : "Australian federal"} elections poll by poll – every campaign cycle in the tracker's record charted against its result, with each pollster's final-poll record.` }] : []),
    { id: "allpolls", label: "All polls",
      desc: `Every published ${VIC ? JV.adj : "Australian federal"} opinion poll since the ${VIC ? `${DATA.elections[JV.baseline].date.slice(0, 4)} Victorian` : "May 2025 federal"} election – primary votes, two-party preferred and leadership ratings, with fieldwork dates and samples, month by month.` },
    /* the ☰ menu's pages (TABS' menu entries), out of All polls 2026-10-15 */
    { id: "disagreement", label: "Poll disagreement",
      desc: `How much the ${VIC ? JV.adj : "Australian federal"} polls disagree – how far they sit from the trend through them, month by month, against the spread sampling error alone would leave.` },
    { id: "leans", label: "Pollster leans",
      desc: `How each ${VIC ? JV.adj : "Australian federal"} pollster leans – its figures against the other houses polling at the same time, on the two-party and primary votes, month by month.` },
    { id: "flows", label: "Respondent-allocated preference flows",
      desc: `Where ${VIC ? JV.adj : "Australian federal"} preferences are flowing now – what voters tell pollsters, and what the pollsters' own two-party figures imply, set against the flows of the last election.` },
    /* the ☰ menu's fourth page, straight under Respondent-allocated preference
       flows (the user's 2026-10-15 call: the explainer was a dressed satellite
       at /preference-flows/, moved here as a page of the build – a federal
       page only, /vic/'s menu never holds it) */
    ...(VIC ? [] : [{ id: "flows-explained", label: "Preference flows explained",
      desc: "How preferences decide the Australian federal two-party figure – the pollsters' published figures, and the figure implied from one fixed preference-flow table, with the counts and contests each setting rests on." }]),
    /* the ☰ menu's fifth page, straight under the explainer: what the
       pollsters ask beyond voting intention, by topic (the 2026-10-17
       catalogue at /ad-hocs/, curated and renamed 2026-10-18; renamed Public
       opinion 2026-10-20; URL became /public-opinion/ 2026-10-21 – both
       retired paths are hand-kept redirect stubs).
       Federal only, /vic/'s menu never holds it */
    ...(VIC ? [] : [{ id: "public-opinion", label: "Public opinion",
      desc: "What Australians tell the pollsters beyond their vote – Donald Trump, immigration, One Nation, the budget and housing tax, the cost of living, the Iran war, Bondi, climate and more – charted across pollsters, with every figure and source." }]),
    /* the ☰ menu's sixth page, straight under Public opinion (the user's
       2026-10-15 call, same pass as the explainer: the change log was the
       Info about-block's tail, then a console satellite at /changelog/;
       now a page of the build – federal only, /vic/ has no change log) */
    ...(VIC ? [] : [{ id: "changelog", label: "Changelog",
      desc: "The auspol tracker change log – what has moved the aggregate's two-party preferred estimate, and when each statistical finding appeared or fell away, as well as the economic-confidence gauges, recorded entry by entry as new readings land." }]),
    { id: "info", label: "Info",
      desc: `How ${BRAND} tracker works – the aggregate's weighting and house-lean method, the pollsters it tracks, and a glossary of the terms the site uses.` },
  ];
  for (const t of tabs) {
    const url = PAGE_URL + t.id + "/";
    let doc = html
      .replace(`<title>${BASE_TITLE}</title>`, `<title>${BRAND} tracker – ${t.label}</title>`)
      .replace(`<meta property="og:title" content="${BASE_TITLE}">`, `<meta property="og:title" content="${BRAND} tracker – ${t.label}">`)
      .replaceAll(`content="${metaDesc}"`, `content="${t.desc}"`)
      .replace(`<meta property="og:url" content="${PAGE_URL}">`, `<meta property="og:url" content="${url}">`)
      .replace(`<link rel="canonical" href="${PAGE_URL}">`, `<link rel="canonical" href="${url}">`)
      .replace(/<article class="static-summary">[\s\S]*?<\/article>/, () => buildTabSummary(t.id))
      .replace("<script>window.AP_CYCLE_SRC=", `<script>window.AP_INITIAL_TAB=${JSON.stringify(t.id)};<\/script>\n  <script>window.AP_CYCLE_SRC=`);
    /* the WebPage JSON-LD must name THIS document, not the root page */
    if (VIC) doc = doc.replace(
      /<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"WebPage"[\s\S]*?<\/script>/,
      () => vicPageJsonLdFor(`${BRAND} tracker – ${t.label}`, url, t.desc));
    if (!VIC) doc = doc.replace(/href="assets\//g, 'href="/assets/').replace(/url\("assets\//g, 'url("/assets/');
    /* the hashed js files ride one level up per folder: a tab document sits
       a folder down from its root page (Vic's two, since vic/ itself sits a
       folder down), so its script srcs re-root accordingly */
    doc = doc.replace(/src="assets\//g, 'src="../assets/');
    if (VIC) doc = doc.replace(/src="\.\.\/assets\//g, 'src="../../assets/');
    fs.mkdirSync(path.join(BASE_DIR, t.id), { recursive: true });
    writeAtomic(path.join(BASE_DIR, t.id, "index.html"), withScriptPreloads(doc));
  }
  console.log(`  + ${tabs.map((t) => (VIC ? "vic/" : "") + t.id + "/").join(", ")} · one document per tab`);
}

/* The root document starts its first screen with only the modules that
   screen draws; the rest load once the app has painted (loadLate, the
   73de0c58 asset), so the critical ones get the whole connection. The tab
   documents above were cut from the full tag list - each renders its own
   tab first and needs its module from the start. Order is kept: the late
   list runs in the order the tags did. */
const LATE_MODULES = ["data-late", "data-vic-late", "pv-agg", "a11e1559-f455-44d5-8a31-6699de4ef310-late", "d1a1d215-370c-4ebc-878b-7eeea9ad8102-late", "copy-chart", "copy-poll", "explained", "wm-story", "rd-panels", "rd-polls", "rd-cycles", "rd-allpolls", "rd-beyond"];
{
  const late = [];
  html = html.replace(/\n?[ \t]*<script src="((?:\.\.\/)*assets\/js\/([\w-]+)\.[0-9a-f]{8}\.js)"><\/script>/g,
    (tag, src, base) => (LATE_MODULES.includes(base) ? (late.push(src), "") : tag));
  const want = LATE_MODULES.filter((b) => jsBases.includes(b));
  if (late.length !== want.length) throw new Error(`late modules: found ${late.length} of ${want.length}`);
  if (!html.includes("<script>window.AP_CYCLE_SRC=")) throw new Error("late modules: AP_CYCLE_SRC anchor missing");
  html = html.replace("<script>window.AP_CYCLE_SRC=", `<script>window.AP_LATE=${JSON.stringify(late)};<\/script>\n  <script>window.AP_CYCLE_SRC=`);
}
/* The root documents' CSS splits the same way. A rule whose every selector
   names a class only late code ever writes cannot match anything before the
   late modules run - every element carrying such a class is made by them -
   so those rules (~half the CSS) ride in late-css.<hash>.js, first in the
   late list, which appends them as a <style> at the end of <body>, ahead of
   any late code rendering. A class counts as late only when its name occurs
   in a late chunk and nowhere in the document's own markup or a critical
   chunk; a class built at runtime from pieces is found nowhere and stays
   critical. Tab documents keep every rule inline. Moved rules now come after
   the kept ones, so the cascade was checked by computed style, element by
   element, on every view reached from the root (1380/390, light/dark). */
{
  const markup = html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
  const lateSrcs = JSON.parse(html.match(/window\.AP_LATE=(\[[^\]]*\])/)[1]).map((s) => s.replace(/^(\.\.\/)*/, ""));
  const crit = [markup], late = [];
  for (const m of html.matchAll(/<script src="((?:\.\.\/)*assets\/js\/[^"]+)"><\/script>/g))
    crit.push(fs.readFileSync(path.join(ROOT, m[1].replace(/^(\.\.\/)*/, "")), "utf8"));
  for (const s of lateSrcs) late.push(fs.readFileSync(path.join(ROOT, s), "utf8"));
  const critText = crit.join("\n"), lateText = late.join("\n");
  const kind = new Map();
  const isLate = (c) => {
    if (!kind.has(c)) {
      const re = new RegExp(`(?<![\\w-])${c.replace(/-/g, "\\-")}(?![\\w-])`);
      kind.set(c, !re.test(critText) && re.test(lateText));
    }
    return kind.get(c);
  };
  const rules = (css) => {
    const out = [];
    for (let i = 0; i < css.length;) {
      const j = css.indexOf("{", i);
      if (j < 0) { if (css.slice(i).trim()) out.push({ raw: css.slice(i) }); break; }
      let depth = 1, k = j + 1;
      while (depth && k < css.length) { if (css[k] === "{") depth++; else if (css[k] === "}") depth--; k++; }
      out.push({ pre: css.slice(i, j).trim(), lead: css.slice(i, j), body: css.slice(j + 1, k - 1), whole: css.slice(i, k) });
      i = k;
    }
    return out;
  };
  /* each top-level rule (an @media/@supports block split into its own kept
     and moved halves) tagged keep or move, in source order */
  const parts = (css) => {
    const out = [];
    for (const r of rules(css)) {
      if (r.raw != null) { out.push({ move: false, text: r.raw }); continue; }
      if (/^@(media|supports)\b/.test(r.pre)) {
        /* the block's own text as it stood, around each run of kept or
           moved rules inside it */
        const runs = [];
        for (const q of parts(r.body)) {
          if (runs.length && runs[runs.length - 1].move === q.move) runs[runs.length - 1].text += q.text;
          else runs.push({ move: q.move, text: q.text });
        }
        for (const q of runs) out.push({ move: q.move, text: `${r.lead}{${q.text}\n}` });
        continue;
      }
      const sels = r.pre.startsWith("@") ? [] : r.pre.split(",");
      const lateRule = sels.length && sels.every((sl) => (sl.match(/\.([\w-]+)/g) || []).some((c) => isLate(c.slice(1))));
      out.push({ move: !!lateRule, text: r.whole });
    }
    return out;
  };
  /* The cascade keeps its order exactly: each run of moved rules leaves an
     empty <style data-lc="n"> where it stood, and the late script fills
     those in place. (One stylesheet appended at the end let a moved rule
     overtake a kept one of equal weight after it - the classic design's
     issue hints lost 4px of margin that way.) */
  const moved = [];
  html = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (_, open, css, close) => {
    let out = open, inMove = false;
    for (const q of parts(css)) {
      if (q.move) {
        if (!inMove) { out += close + `<style data-lc="${moved.length}"></style>` + open; moved.push(""); inMove = true; }
        moved[moved.length - 1] += q.text;
      } else { out += q.text; inMove = false; }
    }
    return (out + close).split(open + close).join("");
  });
  if (moved.length) {
    const esc = JSON.stringify(moved).replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
    const src = emitJs(VIC ? "late-css-vic" : "late-css",
      `(function () { var t = ${esc}; for (var i = 0; i < t.length; i++) { var s = document.querySelector('style[data-lc="' + i + '"]'); if (s) s.textContent = t[i]; } })();`)
      .match(/src="([^"]+)"/)[1];
    /* emitted after the hashed-file sweep above ran, so it sweeps its own
       stale copies - this jurisdiction's base only */
    const cssBase = VIC ? "late-css-vic" : "late-css";
    for (const old of fs.readdirSync(JS_DIR))
      if (new RegExp(`^${cssBase}\\.[0-9a-f]{8}\\.js$`).test(old) && !src.endsWith(old)) fs.unlinkSync(path.join(JS_DIR, old));
    const rel = VIC ? "../" + src : src;
    html = html.replace(/window\.AP_LATE=\[/, `window.AP_LATE=[${JSON.stringify(rel)},`);
  }
}
html = withScriptPreloads(html);
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
// `GRN 6 · IND 3` out of any {code: pct} bag; unknown codes print as-is.
// YouGov prints Community Strong as its own column, which files as the
// machine codes community-strong[-australia] – fold those into OTH, as
// gen-data's switching/flow reads do, and drop the und/dnr residue cells the
// houses exclude from their totals rather than leaking raw codes to readers
const bits = (o) => {
  const flat = new Map();
  for (const [k, v] of Object.entries(o)) {
    if (v == null || k === "und" || k === "dnr") continue;
    const key = k.startsWith("community-strong") ? "oth" : k;
    flat.set(key, (flat.get(key) || 0) + v);
  }
  return [...flat].map(([k, v]) => `${PARTY[k] || k} ${r1(v)}`).join(" · ");
};

const items = feedWaves.map((w) => {
  const p = w.poll || null, year = w.date.slice(0, 4);
  // a row can file tpp_alp with no pair complement (share2pp treats it as a
  // legitimate schema state) - print the figure that exists, not "L/NP null"
  const tpp = p && p.tpp_alp != null
    ? `ALP ${p.tpp_alp}` + (p.tpp_lnp != null ? ` – L/NP ${p.tpp_lnp}` : "")
    : null;
  const prim = p ? shareLine(p) : "";
  const head = tpp ? `2PP ${tpp}`
    : prim || (w.dir ? `Right ${w.dir.right} · Wrong track ${w.dir.wrong}`
    : w.sal || w.own ? "the issues"
    : w.sw ? "vote switching"
    : w.demo ? "the vote by group"
    : "polling release");
  const title = `${w.house}, ${fieldLabel(w)} ${year} – ${head}`;
  const parts = [];
  if (p) {
    if (prim) parts.push(`Primary vote: ${prim}.`);
    if (prim) parts.push(tpp ? `Two-party preferred: ${tpp}.` : "No two-party figure published.");
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
   it. Both files key off SITE_URL, so a future CNAME moves them for free –
   and robots.txt is inert at a github.io project path (only the host-root
   file is honoured) precisely until one exists. */
/* The hand-maintained poll archives were first added by editing this OUTPUT
   file, so every rebuild dropped them again; they live here now. Their
   lastmod is a fixed date — the build can't know when those pages last
   changed, so anyone touching them bumps ARCHIVE_STAMP. /newspoll-archive/
   is only a redirect stub to /archives/newspoll/ and stays OUT of the
   sitemap (canonical entry points belong to the real pages). The hub page
   moved to /provenance/ on 2026-10-24 (Provenance, where the site's data
   has been sourced); /archives/ itself reverted to a redirect stub and
   stays OUT, while /provenance/ carries the hub's entry. */
const ARCHIVE_STAMP = "2026-10-24";
/* prediction/ is not hand-maintained: it regenerates daily via
   .build/refresh-prediction.mjs, which bumps this stamp itself. Dating those
   runs with ARCHIVE_STAMP would falsely datestamp the hand-maintained pages. */
const PREDICTION_STAMP = "2026-10-26";
/* map/ is hand-built (.build/map/): its data is the House as at this date (the
   "Now" overlay's asOf); bump it with each rebuild of map/data */
const MAP_STAMP = "2026-10-25";
/* Tab pages are born the day the build first emits them; a page younger
   than the data it carries must not be dated before it existed, so their
   lastmod is the later of the go-live stamp and the data stamp (the
   VIC_STAMP pattern below). Bump yours when a new tab page ships. */
const TAB_STAMP = { cycles: "2026-10-11", allpolls: "2026-10-11", info: "2026-10-11",
  disagreement: "2026-10-15", leans: "2026-10-15", flows: "2026-10-15",
  "flows-explained": "2026-10-15", "public-opinion": "2026-10-21", changelog: "2026-10-12" };
const tabLastmod = (id) => (TAB_STAMP[id] || "") > dataStamp ? TAB_STAMP[id] : dataStamp;
/* vic/ is rebuilt from data/vic-polls.json (npm run build:vic), so it is
   dated as this page is, by its data – the newest Victorian poll's
   fieldwork end – or by the rebuild onto this page's code, 2026-10-05,
   whichever is later. */
const VIC_RAW = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "vic-polls.json"), "utf8")); }
  catch { return null; }
})();
const VIC_STAMP = (() => {
  const CODE = "2026-10-05";
  if (!VIC_RAW) return CODE;
  const data = [...(VIC_RAW.polls || []), ...(VIC_RAW.leadership || [])].map((r) => r.fwEnd || r.date).filter(Boolean).sort().pop() || CODE;
  return data > CODE ? data : CODE;
})();
/* The Vic build emits the same tab pages through the same code path as 5a,
   but the sitemap is a federal-pass output, so the federal pass lists them
   here. /vic/cycles/ appears only once the mapped dataset records an
   election older than the term-opening baseline (the raw file carries no
   elections object, which is why this reads the schema map rather than the
   file) – the same rule build 5a emits the page by. */
const VIC_TAB_IDS = await (async () => {
  const MENU = ["disagreement", "leans", "flows"];
  if (!VIC_RAW) return ["allpolls", ...MENU, "info"];
  try {
    const vd = (await import("../vic/to-main-schema.mjs")).vicToMain(VIC_RAW);
    return Object.keys(vd.elections || {}).some((k) => k !== vd.jurisdiction.baseline)
      ? ["cycles", "allpolls", ...MENU, "info"] : ["allpolls", ...MENU, "info"];
  } catch { return ["allpolls", ...MENU, "info"]; }
})();
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${dataStamp}</lastmod>
  </url>
${["cycles", "allpolls", "info", "disagreement", "leans", "flows", "flows-explained", "public-opinion", "changelog"].map((id) => `  <url>
    <loc>${SITE_URL}${id}/</loc>
    <lastmod>${tabLastmod(id)}</lastmod>
  </url>`).join("\n")}
  <url>
    <loc>${SITE_URL}provenance/</loc>
    <lastmod>${ARCHIVE_STAMP}</lastmod>
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
    <loc>${SITE_URL}map/</loc>
    <lastmod>${MAP_STAMP}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}prediction/</loc>
    <lastmod>${PREDICTION_STAMP}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}vic/</loc>
    <lastmod>${VIC_STAMP}</lastmod>
  </url>${VIC_TAB_IDS.map((id) => `
  <url>
    <loc>${SITE_URL}vic/${id}/</loc>
    <lastmod>${VIC_STAMP}</lastmod>
  </url>`).join("")}
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
