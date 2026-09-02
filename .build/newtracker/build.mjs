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
import { validate } from "./validate.mjs";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
/* index.html, so a static host serves it at the site root with no config and
   no redirect. The name is the deploy contract, not a description. */
const OUT = path.join(ROOT, "index.html");

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
const A = (f) => path.join(HERE, "assets", f);

/* Where a correction goes. The site is static – GitHub Pages serves files and
   cannot process a POST – so the form posts to Formspree, whose server takes
   the submission and emails it on. The id is the tail of the endpoint URL on
   the form's Formspree dashboard (formspree.io/f/XXXXXXXX); it is public by
   necessity, since it ships in the page.
   Set it here, or pass FORMSPREE_ID= in the environment. Left empty, the whole
   report-an-error block is simply not rendered – a half-configured build shows
   no form rather than a form that silently drops what a reader types. */
const FORMSPREE_ID = (process.env.FORMSPREE_ID || "myzkjdnp").trim();

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
const PLAIN = [
  "9f09dca2-bd46-49a8-8ae1-51847608cf92.js",
  "ed2260de-5b11-4bd5-8a8d-a391156c05ee.js",
  "np-project.js", // the next-polls projection (needs window.AP; the sim evals this same file)
  "copy-chart.js", // per-chart copy-as-image button
];
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

/* -- fonts: 10 @font-face rules over 10 files -> 6 latin faces -------------
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
  { file: "crimsontext-700-latin.woff2",        family: "Crimson Text", style: "normal", weight: "700", preload: true },
  { file: "crimsontext-italic-400-latin.woff2", family: "Crimson Text", style: "italic", weight: "400" },
  { file: "crimsontext-italic-600-latin.woff2", family: "Crimson Text", style: "italic", weight: "600" },
  { file: "crimsontext-italic-700-latin.woff2", family: "Crimson Text", style: "italic", weight: "700" },
  /* Newsreader sets ONLY the hero's 2PP figures - one variable cut (wght
     200-800 + an optical-size axis the browser steers by font-size, so the
     68px readout gets the display cut and its true 800 weight). Preloaded -
     it paints the biggest text on the page. */
  { file: "newsreader-latin.woff2",             family: "Newsreader", style: "normal", weight: "200 800", preload: true },
  { file: "ibmplexsans-latin.woff2",            family: "IBM Plex Sans", style: "normal", weight: "300 700", preload: true },
  /* Source Sans 3 stays shipped for one scoped caller: the .wordmark
     lockup, which keeps its pre-swap face. */
  { file: "sourcesans3-latin.woff2",            family: "Source Sans 3", style: "normal", weight: "400 800", preload: true },
  /* Archivo sets the expanded poll breakdown's figures only - one variable
     cut carries 400/700/800, and it sits behind a click, so no preload. */
  { file: "archivo-latin.woff2",                family: "Archivo", style: "normal", weight: "100 900" },
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
  fs.writeFileSync(path.join(FONT_DIR, name), buf);
  const href = `assets/fonts/${name}`;
  /* Only the two faces that paint text on the way in are preloaded. The italic
     serif sets a handful of small labels, so it can arrive with the rest of
     the page rather than competing with it for the first connections. */
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

const faceStart = html.indexOf("@font-face");
const faceEnd = html.lastIndexOf("}", html.indexOf("</style>", faceStart)) + 1;
if (faceStart < 0 || faceEnd <= faceStart) throw new Error("font block not found");
html = html.slice(0, faceStart) + faceCss + html.slice(faceEnd);

// -- head: drop the vestigial Google preconnects (the faces are served from
//    this origin, so these were two pointless handshakes to Google), and give
//    it a tab icon + a share card --
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

/* Pull the derived headline straight out of the dataset gen-data just wrote,
   so the card's stamp check and its alt text quote the same numbers the page
   does rather than a second, drifting copy. */
function grabLatest() {
  const src = fs.readFileSync(A("9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8");
  const i = src.indexOf("const latest = ");
  if (i < 0) throw new Error("latest not found in dataset");
  return JSON.parse(src.slice(i + 15, src.indexOf("\n", i)).replace(/;$/, ""));
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

const fav = buildFavicon();
console.log("  favicon:", fav.note);
console.log(`  theme-color: ${THEME_LIGHT} light · ${THEME_DARK} dark (matches --bg / the pinned bar)`);
const favicon = encodeURIComponent(fav.svg);

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
  const src = fs.readFileSync(A("9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8");
  const grab = (name) => {
    const i = src.indexOf("const " + name + " = ");
    if (i < 0) throw new Error("static summary: " + name + " not found");
    return JSON.parse(src.slice(i + name.length + 9, src.indexOf("\n", i)).replace(/;$/, ""));
  };
  const L = grab("latest"), prim = grab("aggPrimary").slice(-1)[0];
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
          <td>${r.alp2pp != null ? r.alp2pp.toFixed(1) + "%" : "&#8211;"}</td>
          <td>${r.lnp2pp != null ? r.lnp2pp.toFixed(1) + "%" : "&#8211;"}</td>
        </tr>`).join("");

  /* A table, not a flex list: reader engines honour table columns but drop
     flexbox, which left one space between the party and its share. */
  const primary = ["alp", "lnp", "grn", "onp", "oth"]
    .filter((k) => prim[k] != null)
    .map((k) => `<tr><th scope="row">${PARTY[k]}</th><td>${prim[k].toFixed(1)}%</td></tr>`).join("\n          ");

  /* Same pollster list as MethodNote: straight from the archive, busiest
     first. It is part of the sourcing, not a footer to drop. */
  const counts = {};
  polls.forEach((p) => { counts[p.pollster] = (counts[p.pollster] || 0) + 1; });
  const sources = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).join(", ");

  return `<article class="static-summary">
      <h1>auspol tracker</h1>
      <p class="ss-sub">Aggregated opinion polling for the next Australian federal election, set against the last five.
        ${raceLine(L)} two-party preferred (&#177;${L.alp2ppCi95}) &#8211; updated <time datetime="${esc(L.updatedISO)}">${esc(L.updated)}</time> from
        ${L.pollsTracked} published polls across ${L.housesTracked} polling houses. Next election due ${esc(L.nextElectionDue[0].toLowerCase() + L.nextElectionDue.slice(1))}.</p>

      <h2>Two-party preferred</h2>
      <p class="ss-lead"><b>Labor ${L.alp2pp.toFixed(1)}%</b> &#183; <b>Coalition ${L.lnp2pp.toFixed(1)}%</b></p>
      <p>${who} leads by ${Math.abs(lead).toFixed(1)} points
        (&#177;${(2 * L.alp2ppCi95).toFixed(1)} on the lead). The aggregate is a sample- and
        recency-weighted,
        house-effect-adjusted mean over a ${L.method.windowDays}-day window
        (${L.method.halfLifeDays}-day half-life), carrying a 95% interval of
        &#177;${L.alp2ppCi95.toFixed(1)} points on each share from ${L.method.nPolls} polls. Repeat waves from
        one house inside a window or a calendar month count for the square root of their number,
        so three weekly waves count as 1.7, not 3.</p>

      <h2>Primary vote</h2>
      <table class="ss-primary">
        <tbody>
          ${primary}
        </tbody>
      </table>

      <h2>Latest polls</h2>
      <p class="ss-cap" id="ss-polls-cap">Most recent published national polls</p>
      <table class="ss-table" aria-labelledby="ss-polls-cap">
        <thead><tr><th scope="col">Pollster</th><th scope="col">Fieldwork</th><th scope="col">Sample</th><th scope="col">ALP 2PP</th><th scope="col">L/NP 2PP</th></tr></thead>
        <tbody>${rows}
        </tbody>
      </table>

      <h2>About this tracker</h2>
      <p>auspol tracker pools every published national voting-intention poll since the May 2025 federal
        election. The two-party and primary-vote aggregates are weighted means: recent and larger
        polls count for more, and each pollster&#8217;s figure is adjusted for its own lean against
        the consensus of all houses. The lean is measured separately for every measure &#8211; a firm
        that leans one way on the classic two-party is not assumed to lean the same way on a primary
        share or an ALP-v-One Nation head-to-head &#8211; and a matchup too few houses ask is left as
        a plain monthly average rather than adjusted on guesswork. The leaders&#8217; ratings and
        national direction run through the same monthly weighting and adjustment; preferred prime
        minister and the undecided share stay as plain averages, the differences there being a
        matter of question wording rather than lean. Houses that publish no two-party
        figure feed the primary-vote and leadership series only. Each poll&#8217;s weight rests on
        its published effective sample where the house files one &#8211; Newspoll, YouGov, Essential
        and DemosAU do, via their Australian Polling Council methodology statements &#8211; and on
        its raw sample otherwise.</p>
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
      <p>Each dot is one published poll; the lines are monthly aggregates, shaded with the 95%
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

      <p class="ss-note">Unofficial aggregate of published national polling. Aggregate figures are
        estimates, not measurements &#8211; treat decimal places gently.</p>
    </article>`;
}

if (!html.includes("<!--STATIC_SUMMARY-->")) throw new Error("STATIC_SUMMARY marker not found in template");
html = html.replace("<!--STATIC_SUMMARY-->", "\n    " + buildStaticSummary() + "\n  ");

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
let cardStamp = null;
try {
  cardStamp = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "auspol-card.json"), "utf8")).publishedISO;
} catch (_) { /* no stamp: reported below */ }
const dataStamp = grabLatest().publishedISO;
if (cardStamp !== dataStamp) {
  console.warn(`\n  ! share card is drawn for ${cardStamp || "an unrecorded date"}, data is ${dataStamp}`);
  console.warn(`    it will preview figures that are not the ones on the page.`);
  console.warn(`    regenerate: see .build/newtracker/make-card.js, then update assets/auspol-card.json\n`);
} else {
  console.log(`  share card: current (${cardStamp})`);
}
const cardUrl = `${SITE_URL}assets/auspol-card.png?v=${cardStamp || dataStamp}`;
/* The card is now a chart with figures on it, so its alt says them. Someone
   who cannot see the preview should get the same reading from it. */
const cl = grabLatest();
const cardAlt = `auspol tracker: Labor ${cl.alp2pp.toFixed(1)}, Coalition ${cl.lnp2pp.toFixed(1)} `
  + `two-party preferred, ±${cl.alp2ppCi95.toFixed(1)} points, updated ${cl.updated}, `
  + `with the trend since the 2025 election`;
/* SERP + social description: the tagline phrasing leads, then the race and
   provenance. Figures and their date share a sentence, so a stale cached
   snippet stays self-dating. Reuses the same numbers as the card alt and
   the summary below. */
const metaDesc = `Aggregated opinion polling for the next Australian federal election, `
  + `set against the last five. ${raceLine(cl)} two-party preferred (±${cl.alp2ppCi95}) `
  + `– updated ${cl.updated} from ${cl.pollsTracked} published polls across ${cl.housesTracked} polling houses.`;

/* og:site_name must NOT equal the masthead h1 text: Safari Reader skips any
   title candidate whose text equals og:site_name when og:title exists (its
   site-name de-dup), so "auspol tracker" here disqualified the h1 and let
   "Two-party preferred" win. The domain keeps the two distinct. */
html = html.replace('<meta property="og:type" content="website">',
  `<meta name="description" content="${metaDesc}">
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
  <link rel="icon" href="data:image/svg+xml,${favicon}">
  ${fontLinks.join("\n  ")}`);

/* ---- 5. inline every script ------------------------------------------- */
const parts = [];
/* The cycle-source rows are the individual polls behind every past term. They
   are ~240KB, they are read by nothing outside the Past-cycles tab - its dots
   and its source-polls CSV - and they used to ride in the document as an inert
   application/json block, which cost every visitor the download whether or not
   they ever opened that tab.
   They are a file now, fetched when the tab opens. Named by a hash of its own
   bytes so it caches immutably and a new build invalidates it on its own. */
const cycleSourceJson = fs.readFileSync(A("cycle-source.json"), "utf8");
const cycleSrcName = `cycle-source.${hash8(Buffer.from(cycleSourceJson))}.json`;
for (const old of fs.readdirSync(path.join(ROOT, "assets"))) {
  if (/^cycle-source\..*\.json$/.test(old) && old !== cycleSrcName)
    fs.unlinkSync(path.join(ROOT, "assets", old));
}
fs.writeFileSync(path.join(ROOT, "assets", cycleSrcName), cycleSourceJson);
parts.push(`<script>window.AP_CYCLE_SRC=${JSON.stringify("assets/" + cycleSrcName)};<\/script>`);
for (const f of ["react.production.min.js", "react-dom.production.min.js"])
  parts.push(`<script>${inlineJs(fs.readFileSync(path.join(HERE, "vendor", f), "utf8"))}</script>`);
/* Read by the footer's report-an-error block. Set before the components so it
   is there on first render; empty string = the block does not render at all. */
parts.push(`<script>window.AP_FEEDBACK=${JSON.stringify(FORMSPREE_ID && `https://formspree.io/f/${FORMSPREE_ID}`)};<\/script>`);
for (const f of PLAIN)
  parts.push(`<script>${inlineJs(fs.readFileSync(A(f), "utf8"))}</script>`);
for (const f of JSX)
  parts.push(`<script>${inlineJs(transpile(fs.readFileSync(A(f), "utf8"), f))}</script>`);

/* Splice the inlined scripts in at an explicit marker.
   This used to find the first <script src="{uuid}"> and cut to the LAST
   </script> in the file, which silently depended on every script tag being
   uuid-named and on none of them being the last tag for any other reason. */
if (!html.includes("<!--SCRIPTS-->")) throw new Error("SCRIPTS marker not found in template");
html = html.replace("<!--SCRIPTS-->", parts.join("\n  "));

fs.writeFileSync(OUT, html);

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
const feedPolls = DATA.polls.filter((p) => !p.isElection).slice(-40).reverse();
const shareLine = (p) => {
  const bits = [["ALP", p.alp], ["L/NP", p.lnp], ["GRN", p.grn], ["ON", p.onp],
                ["Ind/Oth", (p.ind ?? 0) + (p.oth ?? 0) || null]]
    .filter(([, v]) => v != null).map(([k, v]) => `${k} ${v}`);
  return bits.join(", ");
};
const items = feedPolls.map((p) => {
  const year = p.date.slice(0, 4);
  const tpp = p.tpp_alp != null ? `ALP ${p.tpp_alp} – L/NP ${p.tpp_lnp}` : null;
  const title = `${p.pollster}, ${fieldLabel(p)} ${year}` + (tpp ? ` – 2PP ${tpp}` : ` – ${shareLine(p)}`);
  const desc = [
    `Primary vote: ${shareLine(p)}.`,
    tpp ? `Two-party preferred: ${tpp}.` : "No two-party figure published.",
    p.undecided != null ? `Undecided ${p.undecided}%.` : null,
    p.sample ? `Sample ${p.sample.toLocaleString("en-AU")}.` : null,
    `Fieldwork ${fieldLabel(p)} ${year}.`,
  ].filter(Boolean).join(" ");
  return `    <item>
      <title>${xesc(title)}</title>
      <link>${xesc(p.url || SITE_URL)}</link>
      <guid isPermaLink="false">auspol-tracker:${xesc(p.date + "|" + p.pollster)}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <description>${xesc(desc)}</description>
    </item>`;
}).join("\n");
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>auspol tracker – new polls</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}feed.xml" rel="self" type="application/rss+xml"/>
    <description>Every national voting-intention poll as it enters the tracker. Items link to the pollster's own release.</description>
    <language>en-AU</language>
    <lastBuildDate>${rfc822(grabLatest().updatedISO)}</lastBuildDate>
${items}
  </channel>
</rss>
`;
fs.writeFileSync(path.join(ROOT, "feed.xml"), feed);

/* ---- 5c. robots.txt + sitemap.xml – be findable -------------------------
   A single-page site is trivially mappable, but a crawler still has to learn
   the page exists and when it last changed. The sitemap carries the one
   canonical URL with the data date as lastmod; robots.txt points crawlers at
   it. auspol-polling.html belongs in neither: its noindex meta is the honest
   signal, and a Disallow would hide that meta from the crawler. Both files
   key off SITE_URL, so a future CNAME moves them for free – and robots.txt
   is inert at a github.io project path (only the host-root file is honoured)
   precisely until one exists. */
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${dataStamp}</lastmod>
  </url>
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemapXml);
fs.writeFileSync(path.join(ROOT, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`);

/* ---- 6. report --------------------------------------------------------- */
import zlib from "node:zlib";
const size = fs.statSync(OUT).size;
const gz = zlib.gzipSync(fs.readFileSync(OUT), { level: 9 }).length;
console.log(`built ${path.basename(OUT)}`);
console.log(`  ${(size / 1024 / 1024).toFixed(2)} MB raw · ${(gz / 1024).toFixed(0)} KB over the wire (gzipped)`);
console.log(`  + assets/fonts · ${[...fontKeep].length} faces, ${(FONTS.reduce((n, f) => n + fs.statSync(path.join(HERE, "fonts", f.file)).size, 0) / 1024).toFixed(0)} KB, cached by hash`);
console.log(`  + assets/${cycleSrcName} · ${(Buffer.byteLength(cycleSourceJson) / 1024).toFixed(0)} KB, fetched only by Past cycles`);
console.log(`built feed.xml · ${feedPolls.length} polls, newest ${feedPolls[0].date} ${feedPolls[0].pollster}`);
console.log(`built sitemap.xml · lastmod ${dataStamp}`);
console.log("built robots.txt");
