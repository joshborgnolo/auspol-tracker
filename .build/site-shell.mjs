/* site-shell.mjs – the chrome every page outside the main build shares with
   the main page, so a reader moving between them never feels they have left
   the site: the masthead, the tab bar (the main page's four views, then the
   poll archives), the colour-theme switch, the live two-party figure, and
   the main page's colophon and tide band.

   Before this the satellites opened on a bare article with no masthead or
   way round the site, and left by a floating "Back to the interactive
   tracker" pill that sat over the text on a phone and said, in as many
   words, that the page was not part of the tracker.

   Where each part lives, and why:
   - assets/site-shell.css and assets/site-shell.js – the styles, and the
     script that runs the theme switch and fills the live figure.
     build.mjs writes both from here on every build (writeShellAssets), into
     assets/, which every updater already commits (stage_dataset in
     git-push-main.sh) – so a change to either reaches every satellite with
     the next build, and no page needs touching.
   - assets/auspol-now.json – the live figure, written by build.mjs beside
     the favicon, whose dial reads the same contest. It is fetched when a
     page loads, because the satellites are not rebuilt with every poll and
     must not be: the updaters commit a fixed list of files that names no
     satellite, so a page the build rewrote would leave the tree dirty and
     stop the laptop's updaters (2026-09-23).
   - The header and footer markup, the early theme script, and class-keyed
     copies of each page's own dark-mode rules – written INTO each page
     between <!--shell:head-->, <!--shell:header--> and <!--shell:footer-->
     markers by applyShell: here (node .build/site-shell.mjs) for the
     hand-maintained pages, and by each generator that writes a satellite
     (refresh-prediction, refresh-morgan-archive, refresh-galaxy-archive,
     refresh-trove-archive) for its own. build.mjs checks every page against
     it and warns on drift – rerun this script and commit the pages.

   The theme follows the reader's choice on the main page: the main page
   keeps its tweaks in localStorage "auspol.tweaks" (same origin), and the
   early script turns {theme, accent} into classes on <html> before first
   paint. "auto" leaves each page's own prefers-color-scheme rules in
   charge, exactly as before; an explicit "light" switches those rules off
   (they are scoped to :root:not(.sh-light)), and an explicit "dark" switches
   on copies of them keyed to :root.sh-dark. The switch in the header writes
   the same key, so a choice made on any page holds on every page.

   /prediction/ and /atlas/ carry the shell but no page links to them – the
   user wants both left unlisted – so no tab is theirs.

   Usage: node .build/site-shell.mjs            apply to every page listed below
          node .build/site-shell.mjs --check    list pages out of step (exit 1 if any) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..");

/* Every page that carries the shell, and its options: `tab` the tab it sits
   under (underlined, aria-current), `page` for the colophon's two
   self-references (the feedback page doesn't invite feedback on itself; an
   archive page doesn't point at the archives). The two redirect stubs
   (archives/index.html, newspoll-archive/index.html) redirect before paint
   and carry nothing. */
export const SHELL_PAGES = [
  { file: "preference-flows/index.html" },
  { file: "prediction/index.html" },                        // written by .build/refresh-prediction.mjs
  { file: "atlas/index.html" },
  { file: "feedback/index.html", page: "feedback" },
  { file: "archives/newspoll/index.html", tab: "archives", page: "archives" },
  { file: "archives/acnielsen/index.html", tab: "archives", page: "archives" },
  { file: "archives/morgan/index.html", tab: "archives", page: "archives" },   // refresh-morgan-archive.mjs
  { file: "archives/galaxy/index.html", tab: "archives", page: "archives" },   // refresh-galaxy-archive.mjs
  { file: "archives/trove/index.html", tab: "archives", page: "archives" },    // refresh-trove-archive.mjs
];
export const shellOptsFor = (file) => SHELL_PAGES.find((p) => p.file === file) || {};

/* The main page's tabs (73de0c58…js TABS, reached by their hash) and then
   the archives, which the main page's own tab bar now carries too. */
const TABS = [
  { id: "snapshot", label: "Snapshot", href: "/#snapshot" },
  { id: "cycles", label: "Past cycles", href: "/#cycles" },
  { id: "allpolls", label: "All polls", href: "/#allpolls" },
  { id: "info", label: "Info", href: "/#info" },
  { id: "archives", label: "Archives", href: "/archives/", cls: " sh-tab-arch" },
];

const SUN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"></circle><path d="M12 2.2v2.4M12 19.4v2.4M2.2 12h2.4M19.4 12h2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"></path></svg>';
const MOON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.2 8.2 0 0 1 9.8 3.5a8.2 8.2 0 1 0 10.7 10.7Z"></path></svg>';

// ---- the markup written into each page ---------------------------------------------
export function shellHeader({ tab } = {}) {
  const tabs = TABS.map((t) => `<a class="sh-tab${t.cls || ""}${t.id === tab ? " active" : ""}" href="${t.href}"`
    + `${t.id === tab ? ' aria-current="page"' : ""}>${t.label}</a>`).join("\n      ");
  return `<a class="sh-skip" href="#sh-content">Skip to content</a>
<div class="sh-frame sh-top">
  <header class="sh-head">
    <a class="sh-brand" href="/" aria-label="auspol tracker – home">
      <span class="sh-words" aria-hidden="true"><span class="sh-name">auspol</span><span class="sh-track">tracker</span></span>
      <img class="sh-glyph" src="/assets/favicon.svg" alt="" width="54" height="54">
    </a>
    <div class="sh-theme" role="group" aria-label="Colour theme">
      <button type="button" class="sh-cell" data-theme="light" aria-pressed="false" aria-label="Light mode" title="Light mode">${SUN}</button><button type="button" class="sh-cell" data-theme="dark" aria-pressed="false" aria-label="Dark mode" title="Dark mode">${MOON}</button>
    </div>
  </header>
  <nav class="sh-tabs" aria-label="Site">
    <div class="sh-tabs-set">
      ${tabs}
    </div>
    <a class="sh-score" href="/#snapshot" hidden title="The latest two-party preferred – go to Snapshot"><span class="sh-eyebrow">2PP</span><span class="sh-party"><span class="sh-abbr sh-abbr-a">ALP</span><span class="sh-num sh-num-a"></span></span><span class="sh-sep" aria-hidden="true"></span><span class="sh-party"><span class="sh-num sh-num-b"></span><span class="sh-abbr sh-abbr-b"></span></span></a>
  </nav>
</div>`;
}

/* The main page's colophon (73de0c58…js MethodNote), word for word: the
   strap-line and the disclaimer are copy families with several homes each
   (auto-skill-auspol-strapline-copy, auto-skill-auspol-disclaimer-copy), and
   this is one of them. */
export function shellFooter({ page } = {}) {
  const fb = page === "feedback"
    ? `How the figures are built is in <a href="/#info">Info</a>.`
    : `How the figures are built is in <a href="/#info">Info</a>. Spot an error, a missing poll, or have any other feedback? Please <a class="sh-fb-link" href="/feedback/">let me know</a>.`;
  const arch = page === "archives" ? ""
    : `\n        <p class="sh-arch">Federal polling archives I’ve located are stored <a href="/archives/">here</a> for safekeeping and convenience.</p>`;
  return `<div class="sh-frame">
  <footer class="sh-foot">
    <div class="sh-colo">
      <div class="sh-about" data-nosnippet>
        <p class="sh-lede">auspol tracker is an unofficial aggregate of published federal opinion polling.</p>
        <p class="sh-disc">Best efforts are made to make the aggregate figures transparent, trustworthy, statistically sound, and informative, but they are, in the end, estimates only.</p>
      </div>
      <div class="sh-ways">
        <p class="sh-fb">${fb}</p>${arch}
      </div>
    </div>
  </footer>
</div>
<div class="sh-band" aria-hidden="true"></div>
<script src="/assets/site-shell.js" defer></script>`;
}

/* Before first paint: the reader's theme and accent from the main page's
   tweaks, as classes on <html>; sh-js lets the switch show only when it
   works. Inline, because a fetched script would paint the page once in the
   wrong theme first. */
const EARLY = `<script>(function(){var c=document.documentElement.classList;c.add("sh-js");try{var t=JSON.parse(localStorage.getItem("auspol.tweaks")||"null")||{};if(t.theme==="light"||t.theme==="dark")c.add("sh-"+t.theme);if(t.accent==="cool")c.add("sh-cool")}catch(e){}})();</script>`;

// ---- each page's own dark-mode rules --------------------------------------------------
/* The page's @media (prefers-color-scheme: dark) blocks, with every rule's
   selector scoped to :root:not(.sh-light) (so an explicit light choice
   switches them off) – idempotent, a scoped selector is left as it is –
   and the rules themselves, unscoped, for the :root.sh-dark copies. */
const DARK_MQ = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{/g;
const SCOPE = ":root:not(.sh-light)";
function scopeDarkRules(html) {
  const rules = [];
  let out = "", at = 0;
  for (const m of html.matchAll(DARK_MQ)) {
    const open = m.index + m[0].length;
    let depth = 1, i = open;
    for (; i < html.length && depth; i++) depth += html[i] === "{" ? 1 : html[i] === "}" ? -1 : 0;
    const body = html.slice(open, i - 1);
    const scoped = body.replace(/([^{}]+)\{([^{}]*)\}/g, (all, sel, decls) => {
      const sels = sel.split(",").map((s) => s.trim()).filter(Boolean);
      // a selector already scoped is its base again (":root" when nothing follows the scope)
      const base = sels.map((s) => s.startsWith(SCOPE) ? s.slice(SCOPE.length).trim() || ":root" : s);
      rules.push({ sels: base, decls: decls.trim() });
      const lead = sel.match(/^\s*/)[0];
      return lead + base.map((s) => (s === ":root" ? SCOPE : `${SCOPE} ${s}`)).join(", ") + " {" + decls + "}";
    });
    out += html.slice(at, open) + scoped + "}";
    at = i;
  }
  return { html: out + html.slice(at), rules };
}
const darkCopies = (rules) => rules.map(({ sels, decls }) =>
  sels.map((s) => (s === ":root" ? ":root.sh-dark" : `:root.sh-dark ${s}`)).join(", ") + " { " + decls.replace(/\s+/g, " ") + " }").join("\n");

// ---- applying the shell -------------------------------------------------------------
const region = (name, body) => `<!--shell:${name}-->\n${body}\n<!--/shell:${name}-->`;
const REGION = (name) => new RegExp(`<!--shell:${name}-->[\\s\\S]*?<!--/shell:${name}-->`);
/* The retired furniture the shell replaces: the fixed back pill, and the
   closing note naming the page as a satellite of the tracker (the colophon
   says what the site is now). A note with more in it than that sentence
   keeps the rest. */
const BACK_PILL = /\n?<a class="ss-back" href="\/">[^<]*<\/a>\n?/g;
// each rule, and the blank line closing the block (as the generators' templates dropped it)
const BACK_PILL_CSS = /^[ \t]*\.ss-back[^{\n]*\{[^}]*\}[ \t]*\n(?:[ \t]*\n)?/gm;
const BACK_PILL_NOTE = /^[ \t]*\/\* -+ back to the interactive tracker \(the static page's \.ss-back pill\) \*\/[ \t]*\n/gm;
const SAT_NOTE = /([ \t]*)<p class="ss-note">(?:This is (?:a satellite (?:archive |analysis )?page|the feedback page)|This page belongs to) (?:of |to )?<a href="\/">auspol tracker<\/a>, an unofficial aggregate of published federal opinion polling\.(?: The live(?:, interactive)? tracker (?:carries|has) the current [^<.]*\.)?\s*([^<]*(?:<(?!\/p>)[^<]*)*)<\/p>\n?/g;

/* The whole page with its shell current. Idempotent: applying it to its own
   output changes nothing, which is what --check and build.mjs test. */
export function applyShell(html, opts = {}) {
  let h = html.replace(BACK_PILL, "\n").replace(BACK_PILL_NOTE, "").replace(BACK_PILL_CSS, "")
    .replace(SAT_NOTE, (all, ind, rest) => (rest.trim() ? `${ind}<p class="ss-note">${rest.trim()}</p>\n` : ""));
  const scoped = scopeDarkRules(h.replace(new RegExp("\\n?" + REGION("head").source), ""));
  h = scoped.html;
  const head = region("head", `<link rel="stylesheet" href="/assets/site-shell.css">\n${EARLY}`
    + (scoped.rules.length ? `\n<style>\n/* this page's dark-mode rules, for a reader who chose dark on a light device */\n${darkCopies(scoped.rules)}\n</style>` : ""));
  h = h.replace(/\n?<\/head>/, "\n" + head + "\n</head>");
  const header = region("header", shellHeader(opts)), footer = region("footer", shellFooter(opts));
  h = REGION("header").test(h) ? h.replace(REGION("header"), header) : h.replace(/(<body[^>]*>)\n?/, `$1\n${header}\n`);
  h = REGION("footer").test(h) ? h.replace(REGION("footer"), footer) : h.replace(/\n?<\/body>/, `\n${footer}\n</body>`);
  // the skip link's target: the page's <main>, which every satellite has
  if (!/id="sh-content"/.test(h)) h = h.replace(/<main(?![^>]*\bid=)/, '<main id="sh-content"');
  return h;
}

// ---- the published files: stylesheet and script -------------------------------------
/* The wordmark's face, by the hashed name build.mjs gives it this build. */
const fontUrl = (prefix) => {
  const dir = path.join(ROOT, "assets", "fonts");
  const f = fs.existsSync(dir) ? fs.readdirSync(dir).find((x) => x.startsWith(prefix) && x.endsWith(".woff2")) : null;
  return f ? `/assets/fonts/${f}` : null;
};

/* The main page's measurements (template.html .page, .site-head, .wordmark,
   .tab, .tab-score, .theme-seg, .method/.colophon, .tile-band), re-set on
   sh- classes so nothing collides with a page's own. Page colours come from
   the page's own tokens (--bg, --ink…, --line…), which every satellite
   defines under the main page's names; what the pages lack – the party
   colours and the switch's plate – is defined here, in both themes. */
export function shellCss() {
  const ss3 = fontUrl("sourcesans3-");
  const DARK_TOKENS = `--sh-alp: oklch(0.660 0.165 28); --sh-lnp: oklch(0.680 0.130 252); --sh-onp: oklch(0.760 0.135 64);
  --sh-surface: oklch(0.252 0.011 66);
  --sh-sw-plate: color-mix(in oklch, black 22%, var(--sh-surface)); --sh-sw-cap: color-mix(in oklch, white 7%, var(--sh-surface));
  --sh-sw-well: color-mix(in oklch, black 44%, var(--sh-surface)); --sh-sw-pivot: color-mix(in oklch, black 58%, transparent);
  --sh-btn-lit: color-mix(in oklch, white 9%, transparent); --sh-btn-shade: oklch(0 0 0 / 0.44);
  --sh-btn-press: color-mix(in oklch, black 48%, transparent);
  --sh-art: url("/assets/tile-art-dark.svg");`;
  return `/* site-shell.css – written by .build/newtracker/build.mjs from
   .build/site-shell.mjs on every build; edit it there. The shared header,
   footer and theme of the pages outside the main build. */
${ss3 ? `@font-face {
  font-family: "Source Sans 3"; font-style: normal; font-weight: 200 900; font-display: swap;
  src: url("${ss3}") format("woff2");
}
` : ""}:root {
  --sh-alp: oklch(0.55 0.150 27); --sh-lnp: oklch(0.50 0.095 250); --sh-onp: oklch(0.52 0.130 58);
  --sh-surface: oklch(0.992 0.004 85);
  --sh-sw-plate: color-mix(in oklch, var(--ink) 5%, var(--sh-surface)); --sh-sw-cap: var(--sh-surface);
  --sh-sw-well: color-mix(in oklch, var(--ink) 13%, var(--sh-surface)); --sh-sw-pivot: color-mix(in oklch, var(--ink) 18%, transparent);
  --sh-btn-lit: color-mix(in oklch, white 85%, transparent); --sh-btn-shade: oklch(0.4 0.02 60 / 0.16);
  --sh-btn-press: color-mix(in oklch, var(--ink) 15%, transparent);
  --sh-art: url("/assets/tile-art.svg");
}
@media (prefers-color-scheme: dark) { :root:not(.sh-light) {
  ${DARK_TOKENS}
} }
:root.sh-dark {
  ${DARK_TOKENS}
}
/* the main page's cool accent (tweaks.accent): the paper and rules go blue-grey */
:root.sh-cool { --bg: oklch(0.972 0.006 235); --sh-surface: oklch(0.993 0.003 235); --line: oklch(0.892 0.009 235); --line-2: oklch(0.934 0.006 235); }
@media (prefers-color-scheme: dark) { :root.sh-cool:not(.sh-light) { --bg: oklch(0.210 0.012 248); --sh-surface: oklch(0.248 0.013 248); --line: oklch(0.352 0.013 248); --line-2: oklch(0.310 0.012 248); } }
:root.sh-cool.sh-dark { --bg: oklch(0.210 0.012 248); --sh-surface: oklch(0.248 0.013 248); --line: oklch(0.352 0.013 248); --line-2: oklch(0.310 0.012 248); }

/* the main page's .page box: the header and footer line up with its own */
.sh-frame {
  box-sizing: border-box; width: 100%; max-width: 1200px; margin: 0 auto; flex: none;
  padding-left: calc(28px + env(safe-area-inset-left, 0px));
  padding-right: calc(28px + env(safe-area-inset-right, 0px));
}
.sh-top { padding-top: calc(28px + env(safe-area-inset-top, 0px)); }
.sh-skip {
  position: absolute; left: 12px; top: -60px; z-index: 400; padding: 8px 12px; border-radius: 8px;
  background: var(--bg); color: var(--ink); border: 1px solid var(--line); font: 600 13px var(--sans);
}
.sh-skip:focus { top: 12px; }

/* masthead: brand left, the switch right (.site-head) */
.sh-head {
  display: flex; justify-content: space-between; align-items: center; gap: 28px; flex-wrap: wrap;
  padding-bottom: 16px; border-bottom: 1px solid var(--line);
}
.sh-brand {
  display: inline-flex; align-items: center; gap: 12px; text-decoration: none; color: var(--ink);
  font-family: "Source Sans 3", system-ui, -apple-system, "Segoe UI", sans-serif;
  border-radius: 8px; padding: 3px; margin: -3px;
}
.sh-brand:focus-visible { outline: 2px solid var(--accent, var(--ink-3)); outline-offset: 2px; }
.sh-words { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 1px; }
.sh-name { font-weight: 800; font-size: 30px; letter-spacing: -0.025em; line-height: 0.95; color: var(--ink); }
.sh-track { font-weight: 400; font-size: 30px; letter-spacing: -0.03em; line-height: 0.95; color: var(--ink-3); }
.sh-glyph { display: block; width: 54px; height: 54px; margin: -7px 0; }

/* the colour switch (.theme-seg): a light switch, the pressed half is the theme */
.sh-theme {
  display: inline-flex; padding: 3px; border-radius: 10px; background: var(--sh-sw-plate);
  box-shadow: inset 0 1px 0 var(--sh-btn-lit), 0 1px 1.5px var(--sh-btn-shade), 0 3px 6px -3px var(--sh-btn-shade);
  visibility: hidden;
}
.sh-js .sh-theme { visibility: visible; }
.sh-cell {
  appearance: none; border: 0; margin: 0; cursor: pointer; padding: 7px 11px; color: var(--ink-3);
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--sh-sw-cap); box-shadow: inset 0 1px 0 var(--sh-btn-lit), 0 1px 1.5px var(--sh-btn-shade);
  transition: background-color .19s, box-shadow .19s, color .19s;
}
.sh-cell:first-child { border-radius: 7px 0 0 7px; border-right: 1px solid var(--sh-sw-pivot); }
.sh-cell:last-child { border-radius: 0 7px 7px 0; }
.sh-cell:hover { color: var(--ink-2); }
.sh-cell[aria-pressed="true"] {
  color: var(--ink); background: var(--sh-sw-well);
  box-shadow: inset 0 2px 3px var(--sh-btn-press), inset 0 -1px 0 var(--sh-btn-lit);
}
.sh-cell[aria-pressed="true"] svg { transform: translateY(0.5px); }
.sh-cell svg { display: block; }
.sh-cell:focus-visible { outline: 2px solid var(--accent, var(--ink-3)); outline-offset: 2px; }

/* the tab bar (.tabs-inner, .tab, editorial .tab-label) */
.sh-tabs {
  position: relative; display: flex; align-items: flex-end; justify-content: space-between; gap: 20px;
  border-bottom: 1px solid var(--line);
}
.sh-tabs-set { display: flex; gap: 30px; align-items: flex-end; }
.sh-tab {
  position: relative; padding: 12px 1px; white-space: nowrap; text-decoration: none;
  font-family: "Crimson Text", var(--serif); font-weight: 600; font-size: 19px; line-height: 23.5px;
  letter-spacing: -0.01em; color: var(--ink-3); transition: color .15s ease;
}
.sh-tab:hover { color: var(--ink-2); }
.sh-tab.active { color: var(--ink); }
.sh-tab::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2.5px;
  background: var(--ink); border-radius: 2px 2px 0 0; transform: scaleX(0); transform-origin: left center;
  transition: transform .2s ease;
}
.sh-tab.active::after, .sh-tab:hover::after { transform: scaleX(1); }
.sh-tab:not(.active):hover::after { background: var(--line); }
.sh-tab:focus-visible { outline: 2px solid var(--accent, var(--ink-3)); outline-offset: 2px; border-radius: 4px; }

/* the live figure, as the main page docks it (.tab-score) */
.sh-score {
  display: inline-flex; align-items: baseline; gap: 9px; padding: 0 1px; white-space: nowrap;
  align-self: center; text-decoration: none; color: var(--ink);
}
.sh-score[hidden] { display: none; }
.sh-eyebrow { font: 700 10.5px var(--sans); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3); margin-right: 2px; }
.sh-party { display: inline-flex; align-items: baseline; gap: 5px; }
.sh-abbr { font: 700 10.5px var(--sans); letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-3); }
.sh-num { font-family: "Crimson Text", var(--serif); font-weight: 600; font-size: 16px; line-height: 1; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.sh-sep { width: 1.5px; height: 13px; background: var(--line-2); align-self: center; position: relative; top: 1px; }

/* the colophon (.method .colophon): identity left, ways in right */
.sh-foot { margin-top: 6px; padding: 24px 0 20px; border-top: 1px solid var(--line); font-family: var(--sans); }
.sh-colo { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.sh-about { padding-right: 40px; border-right: 1px solid var(--line); min-width: 0; }
.sh-ways { padding-left: 40px; min-width: 0; }
.sh-foot p { margin: 0; }
.sh-lede { font-family: "Crimson Text", var(--serif); font-size: 17px; line-height: 1.45; color: var(--ink); }
.sh-disc { margin-top: 13px !important; font-size: 12px; line-height: 1.65; color: var(--ink-3); }
.sh-fb { font-size: 13px; line-height: 1.6; color: var(--ink-2); }
.sh-arch { margin-top: 20px !important; font-size: 13px; line-height: 1.65; color: var(--ink-3); }
.sh-foot a { color: var(--ink-2); text-decoration: none; border-bottom: 1px solid var(--line); }
.sh-foot a:hover, .sh-foot a:focus-visible { color: var(--ink); border-bottom-color: var(--ink); }
.sh-foot a.sh-fb-link { color: var(--ink); font-weight: 600; }

/* the tide band that closes every page (.tile-band) */
.sh-band { flex: none; height: 240px; margin-top: 12px; position: relative; background: var(--sh-art) center bottom / auto 400px repeat-x; }
.sh-band::before {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(to bottom, var(--bg) 0%, color-mix(in oklch, var(--bg) 94%, transparent) 22%,
    color-mix(in oklch, var(--bg) 80%, transparent) 42%, color-mix(in oklch, var(--bg) 54%, transparent) 57%,
    color-mix(in oklch, var(--bg) 25%, transparent) 68%, transparent 76%);
}

/* a page's own column: the space under the new tab bar replaces its old top margin */
.sh-kicker {
  margin: 0 0 6px; font: 700 11px var(--sans); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3);
}

@media (max-width: 640px) {
  .sh-frame { padding-left: calc(16px + env(safe-area-inset-left, 0px)); padding-right: calc(16px + env(safe-area-inset-right, 0px)); }
  .sh-top { padding-top: calc(18px + env(safe-area-inset-top, 0px)); }
  .sh-head { gap: 16px; padding-bottom: 12px; }
  .sh-tabs-set { gap: 14px; }
  .sh-tab { padding-block: 9px; font-size: 16px; line-height: 19.5px; }
  .sh-score { display: none; }
  .sh-colo { grid-template-columns: minmax(0, 1fr); }
  .sh-about { padding-right: 0; border-right: 0; padding-bottom: 16px; }
  .sh-ways { padding-left: 0; padding-top: 16px; border-top: 1px solid var(--line); }
  .sh-band { height: 190px; margin-top: 8px; background-size: auto 320px; }
}
/* the archives yield first where five tabs will not fit – the row is 332px,
   so below a 365px screen (the footer links them too) */
@media (max-width: 365px) { .sh-tab-arch { display: none; } }
@media (prefers-reduced-motion: reduce) { .sh-tab, .sh-tab::after, .sh-cell { transition: none; } }
`;
}

/* The theme switch and the live figure. Plain, dependency-free, and
   forgiving: with no storage or no network the page is simply as it was. */
export function shellJs() {
  return `/* site-shell.js – written by .build/newtracker/build.mjs from
   .build/site-shell.mjs on every build; edit it there. */
(function () {
  var KEY = "auspol.tweaks", root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var read = function () { try { return JSON.parse(localStorage.getItem(KEY) || "null") || {}; } catch (e) { return {}; } };
  var isDark = function () { return root.classList.contains("sh-dark") || (!root.classList.contains("sh-light") && !!(mq && mq.matches)); };
  var cells = document.querySelectorAll(".sh-cell");
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  var paint = function () {
    var d = isDark();
    for (var i = 0; i < cells.length; i++) cells[i].setAttribute("aria-pressed", String((cells[i].getAttribute("data-theme") === "dark") === d));
    // the browser's own bar follows an explicit choice too
    var t = root.classList.contains("sh-dark") ? "#1a1612" : root.classList.contains("sh-light") ? "#faf6f0" : null;
    for (var j = 0; j < metas.length; j++) {
      if (!metas[j].hasAttribute("data-sh-orig")) metas[j].setAttribute("data-sh-orig", metas[j].getAttribute("content"));
      metas[j].setAttribute("content", t || metas[j].getAttribute("data-sh-orig"));
    }
  };
  for (var i = 0; i < cells.length; i++) cells[i].addEventListener("click", function () {
    var theme = this.getAttribute("data-theme");
    root.classList.remove("sh-light", "sh-dark");
    root.classList.add("sh-" + theme);
    var t = read(); t.theme = theme;
    try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {}
    paint();
  });
  if (mq) (mq.addEventListener ? mq.addEventListener("change", paint) : mq.addListener(paint));
  paint();

  // the live figure: the contest the main page leads with, on its default basis
  var score = document.querySelector(".sh-score");
  if (!score || !window.fetch) return;
  fetch("/assets/auspol-now.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (n) {
    if (!n || n.a == null || n.b == null) return;
    score.querySelector(".sh-num-a").textContent = n.a.toFixed(1);
    score.querySelector(".sh-num-a").style.color = "var(--sh-alp)";
    score.querySelector(".sh-num-b").textContent = n.b.toFixed(1);
    score.querySelector(".sh-num-b").style.color = n.rival === "onp" ? "var(--sh-onp)" : "var(--sh-lnp)";
    score.querySelector(".sh-abbr-b").textContent = n.rival === "onp" ? "ON" : "L/NP";
    score.title = "The latest two-party preferred, Labor v " + (n.rival === "onp" ? "One Nation" : "the Coalition") + " – go to Snapshot";
    score.hidden = false;
  }).catch(function () {});
})();
`;
}

// ---- CLI ---------------------------------------------------------------------------
/* Every listed page whose content differs from its shell applied: [file]. */
export function shellDrift() {
  return SHELL_PAGES.filter((p) => {
    const f = path.join(ROOT, p.file);
    if (!fs.existsSync(f)) return false;
    const html = fs.readFileSync(f, "utf8");
    return applyShell(html, p) !== html;
  }).map((p) => p.file);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--check")) {
    const off = shellDrift();
    if (off.length) { console.log("site shell out of step on:\n  " + off.join("\n  ") + "\nrun: node .build/site-shell.mjs"); process.exit(1); }
    console.log(`site shell current on all ${SHELL_PAGES.length} pages`);
  } else {
    for (const p of SHELL_PAGES) {
      const f = path.join(ROOT, p.file);
      if (!fs.existsSync(f)) { console.log("missing", p.file); continue; }
      const html = fs.readFileSync(f, "utf8"), next = applyShell(html, p);
      if (next !== html) { fs.writeFileSync(f, next); console.log("shell applied:", p.file); }
    }
  }
}
