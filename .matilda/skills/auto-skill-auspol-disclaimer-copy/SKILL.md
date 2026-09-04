---
name: auspol-disclaimer-copy
description: auspol-tracker — the footer estimates-only disclaimer is a SECOND two-homes copy pair (MethodNote .disclaimer JSX in the 73de0c58 asset + <p class="ss-note"> in build.mjs buildStaticSummary) — edit both together; per-home apostrophe style (literal curly vs &#8217; entity); line-wrapped source breaks naive one-space greps. Learned 2026-09-03 (commit 8ef7495).
source: auto-skill
extracted_at: '2026-09-03T01:30:00.000Z'
---

# auspol-disclaimer-copy: the second duplicated copy pair

Learned 2026-09-03 ("replace Unofficial aggregate … with auspol tracker is
an unofficial aggregate …", shipped `8ef7495`). The user skill
**auspol-copy-two-homes** maps the METHODOLOGY-prose pair; this is a SECOND,
separate pair it doesn't cover. Rule 4 of MATILDA.md applies: copy edits
move in both homes or not at all.

## The two homes

1. **Live footer disclaimer** — `MethodNote()` in
   `.build/newtracker/assets/73de0c58-f11f-4793-9f90-77e583ab051b.js`,
   the `<div className="disclaimer">` (~lines 1516–1524). JSX text with
   **literal curly apostrophes** (’), same as the rest of that file.
   The archives link: `<a href="https://auspoltracker.com/archives">here</a>`
   kept inline mid-sentence.
2. **Static crawler summary** — `<p class="ss-note">` in
   `buildStaticSummary()` in `.build/newtracker/build.mjs` (~446–452).
   Template literal — **HTML entities, not literals**: `&#8217;` for the
   apostrophe in "I’ve".

Current wording (both homes; `8ef7495` wording, tail word reworded in
`9ab6759`, strap-line tail reworded in `3ee127f`): "auspol tracker is an
unofficial aggregate of published federal opinion polling. Best efforts are
made to make the aggregate figures transparent, trustworthy, statistically
sound, and informative, but they are, in the end, estimates only. Federal
polling archives I’ve located are stored here for safekeeping and convenience."
— wordmark "auspol tracker" lowercase matches template.html:21/23. The leading
sentence (the strap-line) has ELEVEN homes reaching the satellites —
auto-skill-auspol-strapline-copy; this skill only covers the disclaimer
paragraph after it.

## After editing: rebuild + verify with wrap-aware greps

`node .build/newtracker/build.mjs` from the repo root, then check the BUILT
index.html in both renderings:

- Static-summary copy: raw HTML, `&#8217;` entity visible.
- Footer JSX copy: babel-escaped — the curl only reaches `\u2019` etc.
  (user skill auspol-built-html-verification); grep ASCII fragments.
- **Line-wrap trap (the gotcha this session):** a phrase that STRADDLES a
  source line break inside build.mjs's template literal reaches index.html
  with a literal newline+indent, so a single-space grep like
  `"for safekeeping"` returns 1 (JSX-rendered line only) even though BOTH
  copies are present. Verify with a phrase that sits on ONE source line in
  each home (e.g. `"safekeeping and posterity"` → expect 2), or allow for
  the wrap in the pattern.

## Commit footprint

3 files only: the two sources + built `index.html`. feed.xml / sitemap.xml /
robots.txt rebuild byte-identical when nothing else changed; if sitemap.xml
diffs, see auspol-build-pipeline (it's generated too — `d2fa826` moved the
/newspoll-archive entry into build.mjs).
