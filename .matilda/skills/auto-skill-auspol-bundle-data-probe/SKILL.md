---
name: auspol-bundle-data-probe
description: auspol-tracker — verifying healed/added rows actually landed in the BUILT data bundle after a rebuild. PATH FIRST: the bundle is .build/newtracker/assets/9f09dca2-<uuid>.js — the repo-root assets/ is the shipped shell dir (site-shell, cycle-source, fonts) and NEVER contains it; probe it via `new Function` or regex-extract the const from built index.html where the layer is inlined. The consts are minified onto few lines (line-based greps and line-slice JSON.parse both fail), arrays are embedded literals you extract by bracket-depth parsing, and row date keys are `released` / `ym`+`day` — probes filtered on `p.date` silently match nothing. Four failed probes on 2026-09-23, two more on 2026-09-28, before these were pinned.
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
- **Need MANY consts, or a derived value the page will compute? Evaluate the WHOLE asset**
  instead of parsing anything: `new Function("window", src)({})` then read
  `window.AUSPOL.leaderMonths` / `.leaderNow` / `Object.keys(window.AUSPOL)` directly. The
  bundle is a plain self-cataloguing script with no deps beyond `window` — the global name is
  confirmed with `grep -o 'window\.[A-Za-z_]*='` on the asset. Worked 2026-09-28
  (`.matilda/probe/leadership-dek-figures.mjs`): computed the ley-era mean preferred-PM
  margin (18.0), current v Taylor (+4.5) and v Hanson (+12) leads and their first monthly
  readings before writing any dek copy. Reach for this whenever the question is "what will
  the UI say", not "did row X land" — and it makes trap 4 moot, since you inspect the real
  row keys live.
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

## Audit a UI GATE'S precondition offline before probing it in the browser

When a UI element/state is gated on a data condition (a toggle that appears
"when favourability is available", a pill that shows "when the window mixes
metrics"), a browser probe that can never reach the state is DIAGNOSTIC,
not flaky — don't keep re-clicking. First replay the gate offline over the
evaluated bundle: `new Function("window", src)({})` → `window.AUSPOL`, then
iterate `individualPolls` implementing the JSX predicate exactly and count
what fires. Worked 2026-10-01 (metric-toggle, commit 59436ee): the planned
trigger was "window whose wave pairs carry both metric stamps" — the offline
replay printed 0, because `metricOf` is keyed per (firm,leader) with
FAV_FIRMS firm-wide, so a mixed pair window is structurally impossible; the
real signal was `appr.alt`, gen-data buildAppr's second-question channel
(`sp.fav` from a row's `detail`, NOT polls.json `splits.fav` — polling
polls.json shows 0 rows and misleads). Zero-fire = redesign the gate around
what the payload actually carries (here: `appr.alt` exists today only at
Resolve, 6 waves), THEN reopen the browser probe. Rule of thumb: when a
zero-match replay contradicts a worked example in a request AND the
predicate is one step removed from the emitted payload (here, pair gates on
`metricBy` instead of the raw `alt` field), trust the payload. Also read
gen-data's own assembler for the const before trusting any polls.json view
of it — the bundle's `appr.alt` is assembled from `detail`, invisible in
`approval[].splits`.

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
