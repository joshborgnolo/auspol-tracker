---
name: auspol-bundle-data-probe
description: auspol-tracker — verifying healed/added rows actually landed in the BUILT data bundle (assets/9f09dca2-*.js) after a rebuild. The consts are minified onto few lines (line-based greps and line-slice JSON.parse both fail), arrays are embedded literals you extract by bracket-depth parsing, and row date keys are `released` / `ym`+`day` — probes filtered on `p.date` silently match nothing. Four failed probes on 2026-09-23 before these were pinned.
source: auto-skill
extracted_at: '2026-09-23T00:00:00.000Z'
---

# Probing the built data bundle (9f09dca2-*.js)

Use case: polls.json (or another data source) changed and you rebuilt — prove the rows are in
the bundle AND that gen-data attached the optional payloads (`dir`, `tppAlt`, …) to the right
poll rows, WITHOUT spinning up a browser. Worked for the 2026-09-23 Roy Morgan
national-direction heal; the traps below cost four broken probes.

## The four traps (in the order they bit)

1. **Multiline `node -e` probes get mangled by the shell** (regex quoting, `SyntaxError:
   Nothing to repeat`). Write a scratch probe FILE inside the repo instead (BOGAN blocks
   writes to /tmp; `.build/tmp-*.mjs` works) and DELETE it before committing — `git status`
   right before `git add` is the discipline.
2. **Consts are NOT line-anchored.** The bundle is minified into long lines; `const
   individualPolls = [{...` can sit mid-line. `src.split("\n").find(l =>
   l.startsWith("const "+name))` misses it → false "dataset ABSENT". Locate with
   `src.indexOf("const " + name + " =")`.
3. **Array literals + JSON.parse need bracket-depth, not line slices.** A slice ending at the
   last `;` on a line overruns into the next statement ("Unexpected non-whitespace character
   after JSON"). Parse: from the first `[` after the const name, scan char-by-char tracking
   depth and string state (`"` toggles, `\\` escapes) until depth returns to 0; slice and
   `JSON.parse`. (python3 with `json.loads` over the same scan works equally well.)
4. **Date key is `released`, not `date`.** Poll rows in the bundle carry `released` (ISO),
   `ym`, `day`, `x` (sort float) — there is no `date` key. A filter on `p.date >= "..."`
   matches ZERO rows and the probe then wrongly reports the payload missing. When a probe
   matches nothing, first print `Object.keys(row)` of any one row and adjust. The
   `direction`/`directionPolls` consts likewise key on `released`.

## Fastest reliable recipes

- **Tail of a series const** (`direction`, `directionPolls`, …): bracket-depth parse (above),
  filter by `pollster`, print the last N — proves the rows landed.
- **Is an optional payload attached to specific poll rows?** Regex adjacency fails — payloads
  like `dir` can sit after long nested fields (`eff`, `appr`, …) beyond any sane `-o`-window,
  and both emitters order keys differently. Instead: `src.indexOf` a unique row fingerprint
  (`"ym"...,"x":<unstable float>` or `"released":"YYYY-MM-DD"` for a single-wave date), walk
  BACK to the enclosing `{`, bracket-depth FORWARD to its matching `}`, `JSON.parse` the whole
  row, and inspect `row.dir` / `row.tppAlt` directly.
- **Occurrence counts mean emitter-specific things.** `dir` is attached by exactly two
  emitters (gen-data :1358 `individualPolls` = every archive row; :1427 `pollsterTable` =
  the latest row per house only). So a mid-series expected wave appears ONCE; only the
  house's newest wave appears twice. Don't assert `count == waves × 2`.
- Rebuild caveats: `build.mjs` may leave other hashed assets (e.g. `cycle-source.<hash>.json`)
  at the same name — their absence from `git status` is normal, not a failed build.

## Adjacent gotchas

Grepping the built `index.html` for curly-typography copy returns zero matches even when
correct — babel escapes non-ASCII in compiled JS strings to `\uXXXX` (see the
auspol-built-html-verification skill for that side).

Exposing a NEW bundle const to the page is a TWO-step edit: the `const X = …`
emit, AND adding `X` to the explicit shorthand `return { … }` inside
`window.AUSPOL = (function () {…})()` (gen-data ~:3775). A
declared-but-unreturned const compiles and validates clean, and
`D.oldField || fallback` consumers mask it — the 2026-09-24 `157f35c`→
`88aaf46` incident. Probe wiring with
`grep -A2 "<name before yours in the return list>," index.html | grep <your const>`
on the BUILT index.html (full story in auspol-live-site-verify).
