/* test-site-shell.mjs – pins .build/site-shell.mjs: every satellite carries
   the current shell (a page edited around it, or a shell changed without
   re-applying, fails here rather than drifting on the live site), applying
   it is idempotent, it retires the old back pill and satellite note, it
   honours an explicit theme both ways, and nothing – shell or main page –
   links the two pages the user wants left unlisted, /prediction/ and
   /atlas/. Runs after the build in npm test (the shell's CSS names the
   wordmark font by the hash the build gives it). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, SHELL_PAGES, applyShell, shellDrift, shellCss, shellHeader, shellFooter } from "./site-shell.mjs";

// ---- every listed page is current, and carries each part once --------------------------
assert.deepEqual(shellDrift(), [], "a satellite is out of step with its shell – run node .build/site-shell.mjs and commit the pages");
for (const p of SHELL_PAGES) {
  const html = fs.readFileSync(path.join(ROOT, p.file), "utf8");
  for (const r of ["head", "header", "footer"])
    assert.equal(html.split(`<!--shell:${r}-->`).length - 1, 1, `${p.file}: one shell ${r}`);
  assert.ok(!/class="ss-back"/.test(html), `${p.file}: the retired back pill is gone`);
  assert.ok(/<main id="sh-content"/.test(html), `${p.file}: the skip link has its target`);
  assert.equal((html.match(/an unofficial aggregate of published federal opinion polling/g) || []).length, 1,
    `${p.file}: the strap-line once, in the colophon`);
  assert.equal(/class="sh-tab sh-tab-arch active"/.test(html), p.tab === "archives", `${p.file}: Archives underlined only on the archives`);
}

// ---- the markup's variants ----------------------------------------------------------
assert.ok(!/href="\/feedback\/"/.test(shellFooter({ page: "feedback" })), "the feedback page doesn't invite feedback on itself");
assert.ok(/href="\/feedback\/"/.test(shellFooter({})), "every other page does");
assert.ok(!/stored <a href="\/archives\/">here<\/a>/.test(shellFooter({ page: "archives" })), "an archive page doesn't point at the archives");
assert.ok(/estimates only\./.test(shellFooter({})), "the disclaimer rides the colophon");
assert.equal((shellHeader({}).match(/class="sh-tab[" ]/g) || []).length, 5, "the four views and the archives");

// ---- the unlisted pages stay unlisted ----------------------------------------------------
// a link a reader can follow: an <a href> in a page, an href: prop in the main page's
// compiled views (a page's own canonical <link> and og:url are not links)
const unlisted = /(?:<a\b[^>]*\bhref=|\bhref:\s*)"(?:https:\/\/auspoltracker\.com)?\/(?:prediction|atlas)\//;
assert.ok(!unlisted.test(shellHeader({}) + shellFooter({})), "the shell links neither /prediction/ nor /atlas/");
for (const f of ["index.html", ...SHELL_PAGES.map((p) => p.file)])
  assert.ok(!unlisted.test(fs.readFileSync(path.join(ROOT, f), "utf8")), `${f} links /prediction/ or /atlas/`);

// ---- applyShell on a page it has never seen ------------------------------------------------
const page = `<!DOCTYPE html>
<html><head>
<style>
:root { --bg: white; --ink: black; }
@media (prefers-color-scheme: dark) {
  :root { --bg: black; --ink: white; }
}
@media (prefers-color-scheme: dark) { .pos { color: pink; } .neg, .odd { color: blue; } }
/* ------- back to the interactive tracker (the static page's .ss-back pill) */
.ss-back { position: fixed; }
.ss-back:hover { border-color: red; }

p { margin: 0; }
</style>
</head>
<body>
<main class="frame-wrap">
  <h1>A page</h1>
  <p class="ss-note">A note of its own.</p>
  <p class="ss-note">This is a satellite archive page of <a href="/">auspol tracker</a>, an unofficial aggregate of published federal opinion polling. The live, interactive tracker carries the current aggregates, charts and per-poll archive.</p>
  <p class="ss-note">This is a satellite page of <a href="/">auspol tracker</a>, an unofficial aggregate of published federal opinion polling. Figures are computed from AEC results.</p>
</main>
<a class="ss-back" href="/">&larr; Back to the interactive tracker</a>
</body>
</html>
`;
const once = applyShell(page, { tab: "archives", page: "archives" });
assert.equal(applyShell(once, { tab: "archives", page: "archives" }), once, "idempotent");
assert.ok(!/ss-back/.test(once), "the pill, its rules and its comment are gone");
assert.ok(!/satellite archive page/.test(once), "the satellite note is gone");
assert.ok(/<p class="ss-note">Figures are computed from AEC results\.<\/p>/.test(once), "a note with more in it keeps the rest");
assert.ok(/<p class="ss-note">A note of its own\.<\/p>/.test(once), "an unrelated note stays");
// an explicit light choice switches the page's own dark rules off; an explicit dark one on
assert.ok(/:root:not\(\.sh-light\) \{ --bg: black; --ink: white; \}/.test(once), "the dark tokens are scoped");
assert.ok(/:root:not\(\.sh-light\) \.pos \{ color: pink; \}/.test(once), "so are the dark element rules");
assert.ok(/:root:not\(\.sh-light\) \.neg, :root:not\(\.sh-light\) \.odd \{/.test(once), "every selector of a list");
assert.ok(/:root\.sh-dark \{ --bg: black; --ink: white; \}/.test(once), "the dark tokens, for a chosen dark");
assert.ok(/:root\.sh-dark \.neg, :root\.sh-dark \.odd \{ color: blue; \}/.test(once), "the dark element rules, for a chosen dark");
assert.ok(/<body>\n<!--shell:header-->/.test(once) && /<!--\/shell:footer-->\n<\/body>/.test(once), "header opens the body, footer closes it");
assert.ok(/<!--\/shell:head-->\n<\/head>/.test(once), "the head part closes the head, after the page's own styles");

// ---- the published stylesheet names a font that exists ----------------------------------
const font = (shellCss().match(/url\("(\/assets\/fonts\/[^"]+)"\)/) || [])[1];
assert.ok(font && fs.existsSync(path.join(ROOT, font)), `the wordmark's face is on disk (${font})`);

console.log(`PASS: site shell – ${SHELL_PAGES.length} satellites current, idempotent, theme scoping, the unlisted pages unlisted`);
