---
name: auspol-css-override-homes
description: "auspol-tracker — the built page's CSS has TWO source files assembled in a fixed order (template.html's own <style> blocks, then the whole rd.css spliced at template.html:5057 by build.mjs's /*RDCSS*/ replacement), so an equal-specificity override of an rd.css rule placed in template.html SILENTLY LOSES source order — overrides belong in the same file as the base rule. Worked 2026-10-08 (iOS focus-zoom guard): the redesign .rd-ap-search input 16px pointer:coarse override had to live in rd.css next to its base rule, alongside template.html's classic .ap-search guard — a NEW redesign text input under 16px is an iOS zoom bug waiting to happen. Also: multi-agent audit findings must bounce off the actual file before you implement them (the '/archives canonical is wrong' finding dissolved on inspection — /archives/ is a redirect STUB, and a redirect page SHOULD canonicalise to its destination and stay OUT of the sitemap)."
source: auto-skill
extracted_at: '2026-10-08T21:56:53.438Z'
---

# CSS override placement — template.html vs rd.css

## The assembly order (verify with greps, they take seconds)

`index.html`'s inline CSS is built from two sources, in this order:

1. `.build/newtracker/template.html`'s own `<style>` blocks (fonts ~:18,
   main classic/template CSS ~:24→~5050).
2. The ENTIRE `.build/newtracker/assets/rd.css` spliced at
   `template.html:5057` by build.mjs (`html.replace("/*RDCSS*/", …)`,
   build.mjs ~:248) — overwrite rules for the redesign.

Fix I/O consequence: **an override rule placed in template.html cannot beat
an rd.css base rule at equal specificity** — it splices in earlier and
loses source order. Options that work:

- Put the override in **rd.css itself**, right after the base rule
  (same specificity, later position wins). Preferred for redesign-owned
  components — it also keeps the two-homes drift risk in one file.
- Or raise specificity in the template (e.g. add `body.rd`) — legal but
  starts a specificity arms race; the same-file override is cleaner.

Diagnose first with `grep -n "rd-ap-search input" index.html` on the BUILT
file: the line numbers of the base rule vs your override tell you who wins
before any browser opens.

## Worked example: the iOS focus-zoom guard (2026-10-08)

The trap: iOS Safari zooms the page IN on a focused form field whose text
is under 16px and never zooms back out — the whole site stays magnified
until the reader pinches out. template.html:4241–4257 documents the
deliberate choice NOT to fix it with `user-scalable=no` (that permanently
strips pinch-zoom from everyone) and instead bumps the field to 16px under
`@media (pointer: coarse)` — keyed on pointer, not width, because the zoom
follows font size on any touch device (landscape phone, iPad sit past
phone breakpoints).

Homes after the fix:

- Classic `.ap-search input` — the template's pointer:coarse block
  (template.html:4257), fine because its base rules are also template CSS.
- Redesign `.rd-ap-search input` (base `font-size: 14px`, rd.css:2203) —
  guard lives in rd.css directly after the base rule because the template
  location would splice BEFORE rd.css. Pinned by
  `.matilda/probe/rd-ap-zoom.mjs` (touch emulation → computed 16px;
  fine pointer → 14px).

Maintenance rule: **every NEW text input the redesign adds with
`font-size: <16px` needs the same pointer:coarse bump.** When auditing for
this, grep both files for `input` font sizes — don't trust that the
template's guard covers redesign components (its selector only reaches
classic class names).

## Adjacent practice note: bounce audit findings off the file first

Sub-agent audit reports are hypotheses, not facts — the 2026-10-08 sweep's
HIGH-severity "/archives hub canonicalises itself to a child page" finding
dissolved on a 20-line read: /archives/index.html is a hand-maintained
REDIRECT STUB (meta-refresh + location.replace → /archives/newspoll/, with
a comment saying so). A redirecting URL SHOULD canonicalise to its
destination, and it correctly stays OUT of sitemap.xml (sitemaps list
canonical 200 URLs). Reading the actual file before implementing cost one
tool call and prevented a pointless "fix" commit. Applies to any
second-hand finding (agent sweep, external audit, lint report).
