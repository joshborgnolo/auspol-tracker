---
name: auspol-full-site-bug-audit
description: auspol-tracker — running a "find the top-N biggest bugs on the site" full-surface audit (worked 2026-10-13, stop-hook goal, delivered a verified top-20). Four-lens subagent split + own-verification probe kit + the traps that generated false positives (file:// replaceState on modern Chrome, white-on-gradient contrast, WCAG inline-link exemption, link-health.json's `verdict` field not `status`). Use before any "scour the site for bugs / top issues" task.
source: auto-skill
extracted_at: '2026-10-13T02:50:00.000Z'
---

# Full-site bug audit ("top N biggest bugs") — recipe

The one-time bug-hunt session (13 Oct 2026) produced a verified top-20. The
value here is the METHOD plus the false-positive traps, not the bug list
itself (bugs get fixed; the clean-list and traps stay true).

## 1. The four-lens subagent split

Fan out four read-only Explore agents in parallel, each with a scoped brief
and "verify each claim by reading surrounding code; quote file:line" in the
prompt:

1. **Front-end runtime** — every bundle in `.build/newtracker/assets/`
   (PLAIN layers + JSX sources), mutation sites, listener teardowns, URL-state
   writers, keyboard handlers, gen-data emit-shape derefs.
2. **Estimator/data pipeline** — gen-data.mjs + build.mjs + flows/
   demographics/issues; weighting windows, covariance, NaN/div-by-zero paths,
   latent null handling, feed/sitemap generation.
3. **Layout/CSS/template** — template.html + rd.css: media-query seams,
   sticky offsets, focus rings, `100vw/100vh`, `!important`, print CSS.
4. **SEO/feeds/satellites** — head meta, og contracts, feed.xml, sitemap,
   favicon, JSON-LD, SITE_FILES vs generated pages.

Each returns ranked findings + a "verified FINE, do not re-audit" list. The
FINE lists are gold — carry them into the final report as verified-clean so
the top-N isn't padded with unverified claims.

## 2. Read background-agent final reports from the subagents jsonl

When background agents outlive a compaction, their output files are at
`~/.matilda/projects/<proj-slug>/subagents/<session>/agent-Explore-agent_<n>.jsonl`.
Extract the last assistant TEXT message (schema: records have
`message.parts[]` with `{text}` or `{functionCall}` parts — filter parts with
`p.text`, join, take the last one >2500 chars). A record whose last text is
the *prompt* echoed means the agent hasn't finished; `ls -la` mtimes tell
you if it's still writing.

## 3. Own-verification probe kit (`.matilda/probe/`)

Re-verify EVERY high-severity sub-agent claim before listing it. The
reusable probes (all start an ephemeral http server — remember
`p.endsWith("/") → p += "index.html"` — and use
`import puppeteer from "puppeteer-core"` with
`executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
— the playwright-core cache path does NOT exist on this machine):

- **Multi-width overflow sweep**: 7 documents × 9 widths, assert
  `document.scrollingElement.scrollWidth ≤ innerWidth`. Caught the vic
  masthead 641–690px band and the three archive pages' unwrapped `.tabs`.
- **Interactive sweep**: click EVERY tab/facet/sort/search/keyboard control,
  collect console+pageerrors, scan for "hit an error".
- **Touch targets**: measure all `button,[role=button],select,input,a` boxes
  at 360px; report sub-24×24.
- **Contrast audit**: TreeWalker over text nodes, contrast vs nearest
  non-transparent ancestor `background-color` — see the gradient trap below.
- **file:// probes**: load `file://` + path directly; gate URL assertions on
  served-vs-file (urlWrite swallows by design).
- **Skip-link/ARIA**: grep built pages for `sh-skip`; shell pages have it,
  the five main app documents did NOT.

## 4. False-positive traps encountered (record verbatim in the report)

- **file:// `replaceState` does NOT throw in modern Chrome** for
  same-document (query/hash) writes. MATILDA.md's "path change throws
  SecurityError under file://" is about PATH changes; the two bare
  `window.history.replaceState` calls (d1a1d215 asset :3144/:5811) do
  query-only writes and did NOT reproduce a crash — report as latent defect
  + CI blind spot (test-tab-pages.mjs:111 greps only the 73de0c58 bundle),
  not a live crash. ALWAYS reproduce before calling a bug live.
- **Contrast walker**: white text on a `linear-gradient`/image band reports
  as white-on-white (ancestor `background-color` is transparent). A contrast
  sweep that only walks backgroundColor yields ALL false positives — mark
  clean "with gradient caveat" unless you resolve `backgroundImage`.
- **WCAG 2.5.8 (24×24) exempts inline links** in sentences — most sub-24px
  `<a>` hits are exemptions; the genuine failures were checkbox `<input>`s
  at 15–18px. Don't inflate a11y counts with inline links.
- **`data/link-health.json`**: top-level `{version, generated, links[]}`;
  entries use `verdict: ok|wall|moved` (NOT `status`) and a `wayback` field
  that is usually absent. Counting `status` silently countss everything as
  broken. Read the shape before writing any "N dead links" claim.
- **Regex over built bundles**: glossary ids are `{ id: "…"` with spaces —
  a `id:"…"` pattern matches zero and falsely suggests dangling xrefs. When
  counting ids/targets in `d1a1d215`, extract the full infoTerms id space
  (55 ids incl. section ids like `s-2pp`) and the whole INFO_ALIAS map
  (its VALUES must resolve too — `polling-error→how-wrong-are-the-polls`
  only makes sense against section ids, not the 23 glossary entries).
- **Root `assets/` vs `.build/newtracker/assets/`**: hashed JS lives ONLY in
  the latter (inlined into built HTML); root assets/ is JSON/PNG/SVG only.
- **Election-result and intentional rows**: the AEC result row legitimately
  lacks `published`; Essential 2PP rows summing ≠100 are a documented house
  quirk — check documented-exceptions before logging data-hygiene bugs.

## 5. Ranking discipline for the final top-N

- Weigh user-facing breakage and trust promises first (a dead provenance
  twin system outranks estimator cosmetic issues), then a11y baselines
  (focus ring, skip link), then estimator correctness, then cosmetics.
- Merge clusters: the latent null/NaN/negative estimator hazards are ONE
  item; og:image-alt staleness + card/description mismatch are ONE item.
- End with an explicit verified-CLEAN section (what was scoured and held up)
  — it proves the top-N is exhaustive rather than sampled.

## 6. Repo-hygiene notes

- `git fetch` first and note how far local is behind origin/main (a sibling
  session's landing commit may invalidate a finding); probe files go in
  `.matilda/probe/` (gitignored); leave siblings' tracked WIP (e.g.
  PRODUCT.md) untouched.
