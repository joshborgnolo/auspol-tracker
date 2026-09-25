/* site-shell.mjs – the chrome every page outside the main build shares with
   the main page, so a reader moving between them never feels they have left
   the site: the masthead, the tab bar (the main page's four views), the
   colour-theme switch, the live two-party figure, and the main page's
   colophon and tide band.

   The masthead is not a copy of the main page's lockup: it IS the lockup.
   Its rules live between shell-copy markers in newtracker/template.html and
   shellCss() lifts them verbatim; its dial is the same instrument build.mjs
   decides the favicon's contest with, shipped per-build as
   /assets/masthead-dial.svg (the no-JS stand-in) and as a spec in
   auspol-now.json that site-shell.js draws inline (so the mark follows the
   page's theme); clicking it does what the main page's does – replays the
   term – by landing on /#story, which the main page opens its dial story
   for. The navbar carries only the views: the archives and the other
   satellites are linked from the colophon and their own strips, not the tab
   bar (the user, 2026-09-24).

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

/* Every page that carries the shell, and its options: `tab` the view it
   sits under of the four (underlined, aria-current – none takes one today,
   the satellites each being a page of their own in the colophon), `page`
   for the colophon's two self-references (the feedback page doesn't invite
   feedback on itself; an archive page doesn't point at the archives). The
   two redirect stubs (archives/index.html, newspoll-archive/index.html)
   redirect before paint and carry nothing. */
export const SHELL_PAGES = [
  { file: "preference-flows/index.html" },
  { file: "prediction/index.html" },                        // written by .build/refresh-prediction.mjs
  { file: "atlas/index.html" },
  { file: "feedback/index.html", page: "feedback" },
  { file: "archives/newspoll/index.html", page: "archives" },
  { file: "archives/acnielsen/index.html", page: "archives" },
  { file: "archives/morgan/index.html", page: "archives" },   // refresh-morgan-archive.mjs
  { file: "archives/galaxy/index.html", page: "archives" },   // refresh-galaxy-archive.mjs
  { file: "archives/aeforecasts/index.html", page: "archives" }, // refresh-aeforecasts-archive.mjs
  { file: "archives/trove/index.html", page: "archives" },    // refresh-trove-archive.mjs
];
export const shellOptsFor = (file) => SHELL_PAGES.find((p) => p.file === file) || {};

/* The main page's tabs (73de0c58…js TABS, reached by their hash) – the
   views, and nothing else: the archives and the other satellites keep out
   of it here, exactly as they do on the main page. */
const TABS = [
  { id: "snapshot", label: "Snapshot", href: "/#snapshot" },
  // short/pinHide as the main page's TABS: the pinned phone bar's "Cycles",
  // and the tab that yields to the docked score below 380px
  { id: "cycles", label: "Past cycles", short: "Cycles", href: "/#cycles" },
  { id: "allpolls", label: "All polls", href: "/#allpolls" },
  { id: "info", label: "Info", href: "/#info", pinHide: true },
];

const SUN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"></circle><path d="M12 2.2v2.4M12 19.4v2.4M2.2 12h2.4M19.4 12h2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"></path></svg>';
const MOON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.2 8.2 0 0 1 9.8 3.5a8.2 8.2 0 1 0 10.7 10.7Z"></path></svg>';

// ---- the markup written into each page ---------------------------------------------
export function shellHeader({ tab } = {}) {
  const tabs = TABS.map((t) => `<a class="sh-tab${t.pinHide ? " sh-tab-pinhide" : ""}${t.id === tab ? " active" : ""}" href="${t.href}"`
    + `${t.id === tab ? ' aria-current="page"' : ""}>`
    + (t.short ? `<span class="sh-tab-long">${t.label}</span><span class="sh-tab-short" aria-hidden="true">${t.short}</span>` : t.label)
    + `</a>`).join("\n        ");
  /* The lockup is the main page's masthead worn on an <a> instead of a
     <button>: same classes, same hidden spans (extracted shell-copy:brand
     rules style all of it), and it goes where the masthead's click goes –
     the dial, replayed, on /#story. The <img> is the per-build static dial
     the page paints before site-shell.js swaps in the live inline one. */
  return `<a class="sh-skip" href="#sh-content">Skip to content</a>
<div class="sh-frame sh-top">
  <header class="sh-head">
    <div class="sh-brand">
    <div class="wordmark stacked">
      <a class="wm-glyph" href="/#story" title="Wind the dial back through the term" aria-describedby="wm-action">
        <span class="wm-textcol">
          <span class="wm-name">auspol</span>
          <span class="sr-only"> </span>
          <span class="wm-track">tracker</span>
        </span>
        <img class="wm-dial-img" src="/assets/masthead-dial.svg" alt="" width="57" height="39.7">
      </a>
      <span class="wm-sr">– Australian federal polling</span>
      <span id="wm-action" hidden>Replays the term on the masthead dial</span>
    </div>
    <p class="sh-tagline">Aggregated opinion polling for the next Australian <br class="sh-tagline-br">federal election, set against the last <span class="sh-past">twenty</span>.</p>
    <p class="sh-meta-compact" aria-hidden="true" hidden><span class="sh-fresh-dot"></span><span>Updated <span class="sh-pub"></span> · <span class="sh-npolls"></span> polls</span></p>
    </div>
    <div class="sh-right">
    <div class="sh-meta" hidden>
      <div class="sh-meta-item"><span class="sh-meta-k">Last poll</span><span class="sh-meta-v"><span class="sh-fresh-dot"></span><span class="sh-pub"></span><span class="sh-fresh-rel"></span></span></div>
      <div class="sh-meta-divide"></div>
      <div class="sh-meta-item"><span class="sh-meta-k">Next election</span><span class="sh-meta-v sh-due"></span></div>
      <div class="sh-meta-divide"></div>
      <div class="sh-meta-item"><span class="sh-meta-k">Polls tracked</span><span class="sh-meta-v sh-tracked"></span></div>
    </div>
    <div class="sh-theme" role="group" aria-label="Colour theme">
      <button type="button" class="sh-cell" data-theme="light" aria-pressed="false" aria-label="Light mode" title="Light mode">${SUN}</button><button type="button" class="sh-cell" data-theme="dark" aria-pressed="false" aria-label="Dark mode" title="Dark mode">${MOON}</button>
    </div>
    </div>
  </header>
</div>
<div class="sh-tabs-sentinel" aria-hidden="true"></div>
<nav class="sh-tabs" aria-label="Site">
  <div class="sh-frame">
    <div class="sh-tabs-inner">
      <div class="sh-tabs-set">
        ${tabs}
      </div>
      <div class="sh-next" hidden title="Projected from each house's recent publication intervals – the earliest each wave could land, not the likeliest. A slot that passes unrecorded counts up as overdue until the release is added"><span class="sh-tn-lab">Next</span></div>
      <a class="sh-score" href="/#snapshot" hidden title="The latest two-party preferred – go to Snapshot"><span class="sh-eyebrow">2PP</span><span class="sh-party"><span class="sh-abbr sh-abbr-a">ALP</span><span class="sh-num sh-num-a"></span></span><span class="sh-sep" aria-hidden="true"></span><span class="sh-party"><span class="sh-num sh-num-b"></span><span class="sh-abbr sh-abbr-b"></span></span></a>
    </div>
  </div>
</nav>`;
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
    : `\n        <p class="sh-arch">Federal polling archives I’ve located are stored <a href="/archives/newspoll/">here</a> for safekeeping and convenience.</p>`;
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

/* The four faces every satellite paints above the fold – the lockup's Source
   Sans 3, the tabs' and titles' Crimson Text at 400 and 600, and the body's
   IBM Plex Sans – requested with the page rather than once the stylesheets
   that name them have been read (measured: 110–270ms late on every page).
   The hashed names change only when a font does, and the shell's drift check
   catches that. */
const fontPreloads = () => ["ibmplexsans-", "crimsontext-400-", "crimsontext-600-", "sourcesans3-"]
  .map(fontUrl).filter(Boolean)
  .map((u) => `<link rel="preload" href="${u}" as="font" type="font/woff2" crossorigin>\n`).join("");

/* The whole page with its shell current. Idempotent: applying it to its own
   output changes nothing, which is what --check and build.mjs test. */
export function applyShell(html, opts = {}) {
  let h = html.replace(BACK_PILL, "\n").replace(BACK_PILL_NOTE, "").replace(BACK_PILL_CSS, "")
    .replace(SAT_NOTE, (all, ind, rest) => (rest.trim() ? `${ind}<p class="ss-note">${rest.trim()}</p>\n` : ""));
  const scoped = scopeDarkRules(h.replace(new RegExp("\\n?" + REGION("head").source), ""));
  h = scoped.html;
  const head = region("head", fontPreloads() + `<link rel="stylesheet" href="/assets/site-shell.css">\n${EARLY}`
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

/* Every shell-copy:<name> block in newtracker/template.html, verbatim and in
   document order – the masthead's styling has ONE home (the main page's
   template) and reaches every satellite from here. A missing or renamed
   marker fails the build loudly rather than shipping a naked lockup. */
export const shellCopy = (name) => {
  const src = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "template.html"), "utf8");
  const parts = [...src.matchAll(new RegExp("/\\* shell-copy:" + name + " \\*/([\\s\\S]*?)/\\* /shell-copy \\*/", "g"))]
    .map((m) => m[1].trim());
  if (!parts.length) throw new Error("newtracker/template.html lost its shell-copy:" + name + " markers");
  return parts.join("\n");
};

/* The main page's measurements (template.html .page, .site-head, .wordmark,
   .tab, .tab-score, .theme-seg, .method/.colophon, .tile-band), re-set on
   sh- classes so nothing collides with a page's own. Page colours come from
   the page's own tokens (--bg, --ink…, --line…), which every satellite
   defines under the main page's names; what the pages lack – the party
   colours and the switch's plate – is defined here, in both themes. */
export function shellCss() {
  const ss3 = fontUrl("sourcesans3-");
  const TOKENS = shellCopy("tokens"), TOKENS_DARK = shellCopy("tokens-dark");
  const DARK_TOKENS = `${TOKENS_DARK.replace(/^/gm, "  ")}
  --sh-surface: oklch(0.252 0.011 66);
  --sh-sw-plate: color-mix(in oklch, black 22%, var(--sh-surface)); --sh-sw-cap: color-mix(in oklch, white 7%, var(--sh-surface));
  --sh-sw-well: color-mix(in oklch, black 44%, var(--sh-surface)); --sh-sw-pivot: color-mix(in oklch, black 58%, transparent);
  --sh-btn-lit: color-mix(in oklch, white 9%, transparent); --sh-btn-shade: oklch(0 0 0 / 0.44);
  --sh-btn-press: color-mix(in oklch, black 48%, transparent);
  --sh-art: url("/assets/tile-art-dark.svg");
  --sh-mood-pos: oklch(0.70 0.105 200); --sh-mood-neg: oklch(0.68 0.05 45);`;
  return `/* site-shell.css – written by .build/newtracker/build.mjs from
   .build/site-shell.mjs on every build; edit it there. The shared header,
   footer and theme of the pages outside the main build. */
${ss3 ? `@font-face {
  font-family: "Source Sans 3"; font-style: normal; font-weight: 200 900; font-display: swap;
  src: url("${ss3}") format("woff2");
}
` : ""}:root {
  /* the main page's party tokens, lifted verbatim from its template
     (shell-copy:tokens), so this page's dial uses the site's own colours */
  ${TOKENS}
  --sh-surface: oklch(0.992 0.004 85);
  --sh-sw-plate: color-mix(in oklch, var(--ink) 5%, var(--sh-surface)); --sh-sw-cap: var(--sh-surface);
  --sh-sw-well: color-mix(in oklch, var(--ink) 13%, var(--sh-surface)); --sh-sw-pivot: color-mix(in oklch, var(--ink) 18%, transparent);
  --sh-btn-lit: color-mix(in oklch, white 85%, transparent); --sh-btn-shade: oklch(0.4 0.02 60 / 0.16);
  --sh-btn-press: color-mix(in oklch, var(--ink) 15%, transparent);
  --sh-art: url("/assets/tile-art.svg");
  --sh-mood-pos: oklch(0.52 0.085 200); --sh-mood-neg: oklch(0.44 0.045 50);
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

/* masthead: the lockup left, the switch right (.site-head). The lockup is
   the main page's own rules, lifted verbatim from its template (shell-copy
   markers) – one definition for both. */
.sh-head {
  position: relative;
  display: flex; justify-content: space-between; align-items: flex-end; gap: 28px; flex-wrap: wrap;
  padding-bottom: 16px; border-bottom: 1px solid var(--line);
}
/* the tagline and the meta beside it (.tagline, .head-right, .head-meta):
   the same sentence and the same three figures the main page carries, off
   auspol-now.json – so every page opens on the same masthead */
.sh-tagline {
  margin: 7px 0 -1.5px; font-family: "Crimson Text", var(--serif); font-weight: 400;
  font-size: 15px; line-height: 1.5; color: var(--ink-3); text-wrap: balance;
}
.sh-meta-compact { display: none; }
.sh-right { display: flex; align-items: center; gap: 18px; }
.sh-meta { display: flex; align-items: center; gap: 18px; font-family: var(--sans); line-height: 1.5; }
.sh-meta[hidden] { display: none; }
.sh-meta-item { display: flex; flex-direction: column; gap: 2px; }
.sh-meta-k { font-size: 13px; color: var(--ink-3); font-weight: 600; white-space: nowrap; letter-spacing: 0.02em; }
.sh-meta-v { font-size: 14px; color: var(--ink); font-weight: 600; white-space: nowrap; }
.sh-fresh-dot {
  display: inline-block; vertical-align: middle; position: relative; top: -1px;
  width: 7px; height: 7px; border-radius: 50%; margin-right: 7px; background: var(--ink-3);
}
.sh-fresh-dot.fresh { background: var(--sh-mood-pos); }
.sh-fresh-dot.stale { background: var(--sh-mood-neg); }
.sh-fresh-rel { margin-left: 6px; color: var(--ink-3); font-weight: 500; }
.sh-meta-divide { width: 1px; height: 30px; background: var(--line); }
@media (max-width: 900px) { .sh-meta { gap: 12px; } }
@media (max-width: 560px) {
  /* as the main page's phone masthead: the meta gives way to one compact
     freshness line, and the switch pins to the lockup's corner */
  .sh-meta { display: none; }
  .sh-meta-compact:not([hidden]) {
    display: flex; align-items: center; gap: 8px; margin: 9px 0 0;
    font-family: var(--sans); font-size: 13px; line-height: 1.5; color: var(--ink-3); font-variant-numeric: tabular-nums;
  }
  .sh-meta-compact .sh-fresh-dot { margin-right: 0; width: 6px; height: 6px; top: 0; }
  .sh-head { flex-direction: column; align-items: flex-start; gap: 13px; }
  .sh-head .wordmark { padding-right: 92px; }
  .sh-right { display: contents; }
  .sh-theme { position: absolute; top: 0; right: 0; }
}
${shellCopy("brand")}
/* the stand-in the page first paints, swapped for the live inline dial the
   moment auspol-now.json lands – same box the masthead's svg takes */
.wm-dial-img { display: block; overflow: visible; }
${shellCopy("dial")}

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

/* the tab bar, as the main page's (.tabs, .tabs-inner, .tabs-set, .tab):
   flush under the masthead rule, sticky on every page, and once it catches
   the top it pins – the set condenses with ONE composited scale (layout
   never changes, or the sticky bar would oscillate) and a shadow lifts it
   off the content. A satellite has no hero 2PP on screen, so the pin is
   also the main page's show-score moment: the docked score fades in at the
   right end and the next-poll countdown glides to the centre, exactly as on
   the main page's other views. The bar sits outside the masthead frame so
   its sticky range is the whole page. */
/* sticky needs a containing block as tall as the page: the satellites set
   html, body { height: 100% }, which boxed the body at one screen */
body { height: auto; }
.sh-tabs-sentinel { height: 0; flex: none; }
.sh-tabs {
  position: sticky; top: env(safe-area-inset-top, 0px); z-index: 41; flex: none;
  margin-bottom: 26px; background: var(--bg);
}
/* up through the notch while pinned (standalone mode owns that strip) */
.sh-tabs.pinned::before {
  content: ""; position: absolute; left: 0; right: 0; bottom: 100%;
  height: env(safe-area-inset-top, 0px); background: var(--bg);
}
/* the lift-off shadow on its own layer, faded by opacity (compositor only) */
.sh-tabs::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  box-shadow: 0 10px 22px -16px color-mix(in oklch, var(--ink) 55%, transparent);
  opacity: 0; transition: opacity .3s ease;
}
.sh-tabs.pinned::after { opacity: 1; }
.sh-tabs-inner {
  position: relative; z-index: 1;
  display: flex; align-items: flex-end;
  border-bottom: 1px solid var(--line);
  overflow: hidden;
  container-type: inline-size;
}
.sh-tabs-set {
  display: flex; gap: 30px; align-items: flex-end;
  transform-origin: left bottom;
  transition: transform .38s cubic-bezier(.22, 1, .36, 1);
}
.sh-tabs.pinned .sh-tabs-set { transform: scale(0.789); }   /* 19px → 15px, the main page's pin */
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
.sh-tab-short { display: none; }
@media (max-width: 420px) {
  .sh-tabs.pinned .sh-tab-long { display: none; }
  .sh-tabs.pinned .sh-tab-short { display: inline; }
}
@media (max-width: 380px) {
  .sh-tabs.pinned .sh-tab-pinhide { display: none; }
}

/* the docked 2PP score (.tab-score): absolutely seated on the underline at
   the row's right end, so its arrival relayouts nothing */
.sh-score {
  position: absolute; right: 1px; bottom: 0; z-index: 1;
  display: inline-flex; align-items: baseline; gap: 9px; padding: 0 1px 10px; white-space: nowrap;
  text-decoration: none; color: var(--ink);
  opacity: 0; transform: translateY(4px); pointer-events: none;
  transition: opacity .26s ease, transform .34s cubic-bezier(.22, 1, .36, 1);
}
.sh-score[hidden] { display: none; }
.sh-tabs.pinned .sh-score { opacity: 1; transform: none; pointer-events: auto; }
.sh-eyebrow { font: 700 10.5px var(--sans); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3); margin-right: 2px; }
.sh-party { display: inline-flex; align-items: baseline; gap: 5px; }
.sh-abbr { font: 700 10.5px var(--sans); letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-3); }
.sh-num { font-family: "Crimson Text", var(--serif); font-weight: 600; font-size: 16px; line-height: 1; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.sh-sep { width: 1.5px; height: 13px; background: var(--line-2); align-self: center; position: relative; top: 1px; }

/* the next-poll countdown (.tab-next): wide screens only, absolutely seated
   so it glides – docked right until the score owns that end, then to the
   centre, one transform either way. Its roll is np-project.js's, the main
   page's own; items past the measured room park rather than wrap. */
.sh-next { display: none; }
@media (min-width: 1100px) {
  .sh-next:not([hidden]) {
    display: inline-flex; align-items: baseline; gap: 14px;
    position: absolute; bottom: 0; left: 100%; transform: translateX(-100%);
    padding-bottom: 11px; font-family: var(--sans); font-size: 12px; line-height: 1.45; white-space: nowrap;
    color: var(--ink-3); transition: transform .38s cubic-bezier(.22, 1, .36, 1);
  }
  .sh-tabs.pinned .sh-next { transform: translateX(calc(-50% - 50cqw)); }
  .sh-tn-item.sh-tn-park { position: absolute; visibility: hidden; }
}
/* the main page's label is a button whose reset inherits the ticker's own
   12px regular, so that is what it reads as */
.sh-tn-lab { color: var(--ink-3); }
.sh-tn-item { display: inline-flex; align-items: baseline; gap: 6px; }
.sh-tn-firm { font-weight: 700; color: var(--ink-2); }
.sh-tn-when { font-variant-numeric: tabular-nums; }
.sh-tn-overdue { color: var(--sh-mood-neg); }
.sh-tn-maybe { color: var(--ink-3); }
a.sh-tn-link { color: inherit; text-decoration: none; }
a.sh-tn-link:hover, a.sh-tn-link:focus-visible { text-decoration: underline; text-underline-offset: 2px; }
.sh-plink { font-size: 9px; font-weight: 700; margin-left: 3px; vertical-align: 1.5px; color: var(--ink-3); }
@media (prefers-reduced-motion: reduce) {
  .sh-tabs-set, .sh-tabs::after, .sh-score, .sh-next { transition: none; }
}

/* the page's own column sits where the main page's Info column does: on the
   frame's left edge at the Info measure (.info's 66ch, 692px), rather than
   centred on a column of its own – and the archives' switcher with it. The
   tab bar's margin is now the gap above it, as on the main page. */
.frame-wrap {
  max-width: calc(692px + 56px); margin-left: max(0px, calc((100% - 1200px) / 2)); margin-right: auto;
}
.frame-wrap { padding-top: 0; }
/* The Morgan and Trove archives run to ~30,000 table elements; laid out
   whole, that cost a phone-class CPU 350–550ms before the page settled.
   A table off screen now skips layout and paint until it nears the
   viewport, and remembers its real height once seen (auto). */
.frame-wrap .rm-scroll { content-visibility: auto; contain-intrinsic-size: auto 900px; }
/* the page's headings in the main page's editorial voice: a view's title is
   30px regular Crimson (.card-title under body.editorial), not 34px bold,
   and a section head keeps that weight a step down */
.frame-wrap h1 { font-size: 30px; font-weight: 400; letter-spacing: -0.018em; }
.frame-wrap h2 { font-size: 23px; font-weight: 400; letter-spacing: -0.01em; }
/* links in the main page's ink, never a colour of their own: prose links
   keep each page's tinted underline, and a contents list reads as the Info
   index does – ink with a faint underline */
.frame-wrap a { color: var(--ink-2); }
.frame-wrap a:hover { color: var(--ink); }
.frame-wrap .toc a { text-decoration: underline; text-decoration-color: var(--line); text-underline-offset: 3px; }
.frame-wrap .toc a:hover, .frame-wrap .toc a:focus-visible { text-decoration-color: currentColor; }
/* the archives' switcher on the same edge; its underline is drawn across its
   own box, so the frame's inset is margin here, not padding – the rule
   starts where the text does */
nav.tabs[aria-label="Poll archives"] {
  box-sizing: border-box; width: auto; max-width: 692px; padding-left: 0; padding-right: 0;
  margin: 0 calc(28px + env(safe-area-inset-right, 0px)) 22px
          calc(max(0px, (100% - 1200px) / 2) + 28px + env(safe-area-inset-left, 0px));
}

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
  .sh-tabs { margin-bottom: 18px; }
  nav.tabs[aria-label="Poll archives"] {
    margin-left: calc(16px + env(safe-area-inset-left, 0px)); margin-right: calc(16px + env(safe-area-inset-right, 0px));
  }
  .sh-tabs-set { gap: 14px; }
  .sh-tab { padding-block: 9px; font-size: 16px; line-height: 19.5px; }
  .sh-tabs.pinned .sh-tabs-set { transform: scale(0.903); }
  .sh-eyebrow { display: none; }
  .sh-score { gap: 7px; }
  .sh-num { font-size: 15px; }
  .sh-colo { grid-template-columns: minmax(0, 1fr); }
  .sh-about { padding-right: 0; border-right: 0; padding-bottom: 16px; }
  .sh-ways { padding-left: 0; padding-top: 16px; border-top: 1px solid var(--line); }
  .sh-band { height: 190px; margin-top: 8px; background-size: auto 320px; }
}
@media (prefers-reduced-motion: reduce) { .sh-tab, .sh-tab::after, .sh-cell { transition: none; } }
`;
}

/* The theme switch and the live figure. Plain, dependency-free, and
   forgiving: with no storage or no network the page is simply as it was. */
/* np-project.js, the main page's own next-poll projection and roll, run
   here as it is there (inside site-shell.js's function scope, so none of
   its top-level names can meet a page's own). */
const npProjectSrc = () => fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "np-project.js"), "utf8");

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

  /* The lockup squares itself off only while the two words happen to MEASURE
     the same, and at 30px Source Sans 3 sets 'tracker' about 3px short of
     'auspol'. The shortfall is measured and closed, not guessed – the main
     page's Header braces its own copy of this same routine, so both lockups
     square off identically off whatever face actually rendered. The trailing
     letter-spacing unit comes back off BOTH measurements first: it widens
     the box by one unit more than it widens the ink. */
  var wn = document.querySelector(".wm-name"), wt = document.querySelector(".wm-track");
  if (wn && wt) {
    var ink = function (el) {
      var ls = parseFloat(getComputedStyle(el).letterSpacing);
      return el.getBoundingClientRect().width - (isNaN(ls) ? 0 : ls);
    };
    var align = function () {
      wn.style.letterSpacing = ""; wt.style.letterSpacing = "";
      var wide = ink(wn) >= ink(wt) ? wn : wt, narrow = wide === wn ? wt : wn;
      var gaps = narrow.textContent.length - 1;
      if (gaps < 1) return;
      var base = parseFloat(getComputedStyle(narrow).letterSpacing);
      narrow.style.letterSpacing = (((isNaN(base) ? 0 : base) + (ink(wide) - ink(narrow)) / gaps)).toFixed(3) + "px";
    };
    align();
    if (document.fonts) document.fonts.ready.then(align);
  }

  /* ---- the main page's next-poll projection (np-project.js, verbatim) ---- */
  window.AP = window.AP || {};
${npProjectSrc()}
  /* ---- the tab bar pins as the main page's does (Tabs, d1a1d215…js) -------
     A zero-height sentinel marks the bar's natural place; once it scrolls
     off the top the sticky bar has caught it, and .pinned condenses the set,
     lifts the bar, docks the score and moves the countdown (all CSS). */
  var nav = document.querySelector(".sh-tabs"), sent = document.querySelector(".sh-tabs-sentinel");
  var next = document.querySelector(".sh-next");
  var fitNext = function () {};
  if (nav && sent && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      nav.classList.toggle("pinned", !es[0].isIntersecting);
      fitNext(); setTimeout(fitNext, 420);
    }, { threshold: 0 }).observe(sent);
  }
  /* the pinned set's END scale, off a parked pinned bar, so the countdown's
     room is measured against where the glide is heading and the scale in
     the CSS stays the one source (pinnedSetScale on the main page) */
  var probe = null;
  var pinnedScale = function () {
    if (!probe) {
      probe = document.createElement("div");
      probe.className = "sh-tabs pinned";
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = "position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none";
      probe.innerHTML = '<div class="sh-tabs-set"></div>';
      document.body.appendChild(probe);
    }
    var t = getComputedStyle(probe.firstChild).transform;
    if (!t || t === "none") return 1;
    return parseFloat(t.slice(t.indexOf("(") + 1)) || 1;
  };
  /* the fit pass (NextPollTicker's): as many of the roll as clear the tab
     set – right-seated unpinned, centred between the set and the docked
     score once pinned – and the rest parked, still measurable */
  fitNext = function () {
    if (!next || next.hidden || !nav) return;
    var inner = next.parentElement, innerR = inner.getBoundingClientRect();
    if (innerR.width < 1) return;
    var items = next.querySelectorAll(".sh-tn-item");
    for (var i = 0; i < items.length; i++) items[i].classList.remove("sh-tn-park");
    var setEl = inner.querySelector(".sh-tabs-set"), pinned = nav.classList.contains("pinned");
    var setRight = setEl.getBoundingClientRect().left + setEl.offsetWidth * (pinned ? pinnedScale() : 1);
    var SAFE = 56, budget;
    if (pinned) {
      var sc = inner.querySelector(".sh-score"), sr = sc && !sc.hidden ? sc.getBoundingClientRect() : null;
      var c = (innerR.left + innerR.right) / 2;
      budget = 2 * Math.max(0, Math.min(c - setRight, (sr && sr.width ? sr.left : innerR.right) - c) - SAFE);
    } else budget = innerR.right - setRight - SAFE;
    var gap = parseFloat(getComputedStyle(next).columnGap) || 0, used = next.firstElementChild.offsetWidth;
    for (var k = 0; k < items.length; k++) {
      if (used + gap + items[k].offsetWidth > budget) {
        for (var j = k; j < items.length; j++) items[j].classList.add("sh-tn-park");
        break;
      }
      used += gap + items[k].offsetWidth;
    }
  };
  var mk = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  var renderNext = function (n) {
    if (!next || !n.pollCadence || !window.AP.nextPollItems) return;
    window.AP.D = { pollCadence: n.pollCadence };
    var items = window.AP.nextPollItems(window.AP.nextPolls());
    while (next.children.length > 1) next.removeChild(next.lastChild);
    for (var i = 0; i < items.length; i++) {
      var it = items[i], item = mk("span", "sh-tn-item"), firm = mk("span", "sh-tn-firm");
      if (it.site) {
        var a = mk("a", "sh-tn-link", it.firm);
        a.href = it.site; a.target = "_blank"; a.rel = "noopener noreferrer"; a.title = "Where " + it.firm + " publishes";
        var mark = mk("span", "sh-plink", "↗"); mark.setAttribute("aria-hidden", "true");
        a.appendChild(mark); firm.appendChild(a);
      } else firm.textContent = it.firm;
      var when = mk("span", "sh-tn-when" + (it.overdue ? " sh-tn-overdue" : ""), it.when);
      if (it.maybe) when.appendChild(mk("span", "sh-tn-maybe", " (maybe)"));
      item.appendChild(firm); item.appendChild(when); next.appendChild(item);
    }
    next.hidden = !items.length;
    fitNext();
  };
  var startNext = function (n) {
    renderNext(n);
    // the labels count down ("3 days", "any moment now"), so they refresh as the main page's do
    setInterval(function () { renderNext(n); }, 60000);
    if (next && window.ResizeObserver) new ResizeObserver(function () { fitNext(); }).observe(next.parentElement);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitNext(); });
  };
  /* the masthead's meta and tagline count, as the main page's Header fills
     them; the freshness reading is its freshness() (73de0c58…js): whole
     Sydney calendar days, fresh to a week, aging to three */
  var setText = function (sel, v) {
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) els[i].textContent = v;
  };
  var fillHead = function (n) {
    if (n.past) setText(".sh-past", n.past);
    var L = n.latest;
    if (!L) return;
    var days = Math.max(0, Math.round((easternNow().day - Date.parse(L.publishedISO)) / 86400000));
    var rel = days === 0 ? "Today" : days === 1 ? "Yesterday" : days < 14 ? days + " days ago"
      : days < 56 ? Math.round(days / 7) + " weeks ago" : Math.round(days / 30) + " months ago";
    var state = days <= 7 ? "fresh" : days <= 21 ? "aging" : "stale";
    setText(".sh-pub", L.published);
    setText(".sh-fresh-rel", "· " + rel);
    setText(".sh-due", L.nextElectionDue);
    setText(".sh-tracked", L.pollsTracked + " · " + L.housesTracked + " pollsters");
    setText(".sh-npolls", L.pollsTracked);
    var dots = document.querySelectorAll(".sh-fresh-dot");
    for (var i = 0; i < dots.length; i++) dots[i].className = "sh-fresh-dot " + state;
    var hid = document.querySelectorAll(".sh-meta, .sh-meta-compact");
    for (var j = 0; j < hid.length; j++) hid[j].hidden = false;
  };

  // the live figure and dial: what the main page leads with, off one file
  if (!window.fetch) return;
  var score = document.querySelector(".sh-score");
  fetch("/assets/auspol-now.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (n) {
    if (!n) return;
    if (score && n.a != null && n.b != null) {
      score.querySelector(".sh-num-a").textContent = n.a.toFixed(1);
      score.querySelector(".sh-num-a").style.color = "var(--alp)";
      score.querySelector(".sh-num-b").textContent = n.b.toFixed(1);
      score.querySelector(".sh-num-b").style.color = n.rival === "onp" ? "var(--onp)" : "var(--lnp)";
      score.querySelector(".sh-abbr-b").textContent = n.rival === "onp" ? "ON" : "L/NP";
      score.title = "The latest two-party preferred, Labor v " + (n.rival === "onp" ? "One Nation" : "the Coalition") + " – go to Snapshot";
      score.hidden = false;
    }
    fillHead(n);
    startNext(n);
    /* The <img> stand-in steps aside for an inline svg drawn from the spec,
       strokes as var()s so the sheet's own theme rules colour it – the
       masthead's dial, live, not a picture of it. The settle replays too:
       needle in from vertical, graduations growing to their shares (unless
       the reader prefers reduced motion). */
    var img = document.querySelector(".wm-dial-img"), d = n.dial;
    if (!img || !d || !document.createElementNS) return;
    var NS = "http://www.w3.org/2000/svg";
    var el = function (tag, attrs) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    };
    var rivalColor = "var(--" + d.right + ")";
    var svg = el("svg", { "class": "wm-dial", viewBox: d.vp, width: 57, height: 39.7, "aria-hidden": "true" });
    svg.appendChild(el("path", { d: d.arcL, "class": "wm-arc", fill: "none", stroke: "var(--alp)" }));
    svg.appendChild(el("path", { d: d.arcR, "class": "wm-arc", fill: "none", stroke: rivalColor }));
    var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var bars = [];
    for (var bi = 0; bi < d.bars.length; bi++) {
      var b = d.bars[bi];
      var line = el("line", { "class": "wm-bar", x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2,
        stroke: "var(--" + b.id + ")", "stroke-width": 3.4, "stroke-linecap": "butt",
        "stroke-dasharray": (RM ? b.h : d.settle) + " " + d.max });
      svg.appendChild(line);
      bars.push(line);
    }
    var needleRotate = el("g", { "class": "wm-needle-g", transform: "rotate(" + (RM ? d.nd : 0) + ")" });
    needleRotate.appendChild(el("line", { "class": "wm-needle", x1: 0, y1: 0, x2: 0, y2: -8.6,
      stroke: "var(--" + d.leader + ")", "stroke-width": 1.7, "stroke-linecap": "round" }));
    needleRotate.appendChild(el("circle", { "class": "wm-needle-tip", cx: 0, cy: -8.6, r: 1.9, fill: "var(--" + d.leader + ")" }));
    var needleWrap = el("g", { transform: "translate(" + d.cx + ", " + d.cy + ")" });
    needleWrap.appendChild(needleRotate);
    svg.appendChild(needleWrap);
    svg.appendChild(el("circle", { "class": "wm-pivot", cx: d.cx, cy: d.cy, r: 1.7 }));
    img.replaceWith(svg);
    if (!RM) {
      /* first paint must carry the settle state before the goal posts land,
         or there is nothing to animate between */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          needleRotate.setAttribute("transform", "rotate(" + d.nd + ")");
          for (var i = 0; i < bars.length; i++)
            bars[i].setAttribute("stroke-dasharray", d.bars[i].h + " " + d.max);
        });
      });
    }
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
