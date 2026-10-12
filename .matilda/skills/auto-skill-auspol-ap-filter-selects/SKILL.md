---
name: auspol-ap-filter-selects
description: auspol-tracker — the All-polls filter bar's Pollster / Time /
  Includes controls are ACTION-MENU native selects (shipped ae78eda,
  2026-10-09, replacing three FilterPops), the SECOND deployment of the
  draw-a-term select contract (rd-confidence-sel, d69dce0). Read this
  before touching ANY of: the bar's three selects, FilterPop itself
  (still alive in 3 places — never delete), the d1a1d215 pop state
  (still owned there), or RdApSheet's phone Filters sheet (untouched).
source: auto-skill
extracted_at: '2026-10-09T14:30:00.000Z'
updated_at: '2026-10-09T15:05:00.000Z'
---

# All-polls filter bar: native-select menus (ae78eda)

The redesign All-polls bar (`.rd-ap-pops` row in `rd-allpolls.jsx`
RdAllPolls, bar region ~:3224–3260) is now the three
`<select className="rd-ap-sel">` controls at EVERY desktop/tablet
width — the FilterPop popovers are GONE from the redesign bar (the
pills row below still displays the drawn set). Phone keeps its own
`.rd-ap-pinctl` + RdApSheet bottom sheet — untouched.

## The action-menu select contract (copy this for a THIRD deployment)

Model: `drawTerm` select in `rd-panels.jsx` (~:4388, confidence
history) — the pattern came from the cyc-tpp "Draw a past term" chip
rewrite d69dce0. Anatomy:

```jsx
<select
  className="rd-ap-sel"            // joins the shared native-select chrome
  aria-label="…"
  value=""                          // NEVER holds a value — snaps back to
  onChange={(e) => {                //   the disabled label after onChange
    const v = e.target.value;
    if (v === "__clear") { setSel(new Set()); return; }
    toggleHouse(v);                 // or setRange(v) for the value kind
  }}
>
  <option value="" disabled>Pollster</option>   // the visible label
  {houseRank.map((h) => (
    <option key={h} value={h}>
      {(sel.has(h) ? "✓ " : "") + h + " (" + (houseN[h] || 0) + ")"}
    </option>
  ))}
  {sel.size > 0 && <hr />}                       // rule ONLY when live
  {sel.size > 0 && <option value="__clear">✕ Clear</option>}
</select>
```

The two flavours, both in this bar:

- **Action menu** (Pollster, Includes — multi-select sets): `value=""`
  always, the label option is `disabled` (it never renders as a chosen
  value), items carry a `✓ ` prefix when live, and a `__clear` branch
  resets. The Includes variant also keeps its AND-semantics explainer
  as a TRAILING `disabled` option ("Ticking two asks for polls that
  published both.") and each item's note joined as ` — note`.
- **Value select** (Time — single range): same snap-back shell, but
  the tick rides the CURRENT value (`range === id ? "✓ " : ""`) and
  there's no `__clear` ("Any time" is the clear). Counts via
  `rangeN(id)` in the same `(N)` suffix form.

Glyphs: the ✓ survives babel literally; ✕ and non-ASCII dashes are
`\u`-escaped in the BUILT index.html — grep built files for `\u2715`,
never the literal (see auspol-built-html-verification). The drawn set
is shown by the pre-existing pills row beneath, which still owns the
set state — the selects only read/toggle it.

## FilterPop still lives — three homes, don't delete

`FilterPop` (d1a1d215 :4086) + `PopRow` (:4137) were NOT removed:
the legacy archive view (d1a1d215 :5859–5934), the past-cycles board
(:2350), and the `.rd-fl-ct` flow-drift land picker (:4233, inside
rd-allpolls.jsx itself) all still render them. The redesign bar's OWN
`pop/setPop` props were dropped (<RdAllPolls> call :5753), but the
`const [pop, setPop] = useState(null)` state at d1a1d215 :5252 is
KEPT — the legacy view still consumes it. Removing either "dead"
fragment breaks those three homes. The `.rd-ap-bar .ap-popbtn` CSS
rules (~rd.css 2255+ / 2731) stay for the same reason.

## Bar WIDTH: clamp to the label, never the widest option (94692af)

User complaint same day ae78eda shipped: "the drop down menus are too
wide — so much empty space". Root cause: a native select's collapsed
bar sizes to the WIDEST OPTION in its menu (here "A three-cornered
figure (4) — Labor, Coalition and One Nation in one split" → a 517px
Includes bar; Pollster 205px on "Roy Morgan (pooled)"; Time 189px).
For an action-menu (never shows a picked value — the visible marker is
always the disabled label option) that width is pure waste. Fix is
94692af (2026-10-09, on top of a f55ecd9 base, clean rebase):

- Every `rd-ap-sel` got a kind class: `rd-ap-sel-house` /
  `rd-ap-sel-time` / `rd-ap-sel-inc` on the three selects
  (rd-allpolls.jsx ~:3230/3237/3244).
- One fixed `width:` per kind right after the `.rd-ap-pops .rd-ap-sel`
  rule in rd.css ~:2262 — house 110px, time 94px, inc 118px = canvas-MEASURED
  label width (measureText at the select's 14px/500 font ≈ 49/32/56px)
  + the shared chrome's 14/36px horizontal padding + ~10px slack.
  Fixed px (not em) is fine: the 1000px narrow block only shrinks the
  font to 13px, which makes labels NARROWER, so the widths hold there.

Sizing recipe if a 4th action-menu select lands or a label is edited:
headless-probe measure with canvas `ctx.font = weight+" "+size+" "+
family; ctx.measureText(label).width`, then width = label + 50px
(14+36 padding) + ~10px slack, re-measuring the bar at 1366 AND 900
(`getBoundingClientRect().width` on `.rd-ap-pops .rd-ap-sel`). Scratch
probe `.matilda/probe/ap-sel-widths.mjs` prints exactly that (bars,
labels, widest option) at both viewports; always exits 0 — it is a
measurer, not an assertion probe. If the width numbers ever become
assertion-pinned, do it THERE, not in a new probe.

FLAKE WARNING (learnt same day): `ap-walk-floor.mjs` printed "OVERALL
worst drift 46.79 (want 0)" inside a 9-probe battery while every
individual width line read `worst-drift 0.0` — a first-run artefact
(battery feeds, cold page?); a CLEAN standalone re-run of the probe
reported 0.0 across all 12 widths, exit 0. Before treating a
walk-floor (or similar probe) total as a regression from your change,
re-run that probe ALONE from the same build; only then git-bisect.

## CSS: join the existing chrome, don't duplicate

`.rd-ap-sel` was ADDED to the shared rule group at rd.css :678
(`body.rd .rd-pv-sel, body.rd .rd-confidence-sel, body.rd .rd-ap-sel`)
plus its hover :687 / focus :688 lines — extending the selector list,
not a new block. Layout lives in `.rd-ap-pops` (:2255): switched to
`display:inline-flex; flex-wrap:wrap; gap:10px` so three 36px
controls wrap instead of squashing, with a `.rd-ap-pops .rd-ap-sel`
sizing rule (36px desktop) and a narrow-screen block at max-width
1000px (34px, 13px). See auspol-css-override-homes for the
template-vs-rd.css assembly order.

## Verification battery (ran all-green on ae78eda)

Probes exercised (from the worktree, `node .matilda/probe/<n>.mjs`):
ap-split-picker-width, ap-prim-phone-scale, ap-swipe-overflow,
ap-facet-overflow, ap-walk-floor, dbg-allpolls-load, conf-history-interp
(pins the drawTerm contract the pattern copies), rd-ap-zoom,
allpolls-crash (boundary watch), pv-group-select. The last one's 2
"meta identical" failures are a PRE-EXISTING pinned poll-count
baseline at HEAD (170 polls / 6 Oct), not this change — confirm
drift claims by re-running the probe at HEAD before believing them
(auspol-probe-drift-repair).

TRAP: `.matilda/probe/ap-sum.mjs` is a STANDALONE-STDIN SUMMARISER
for ap-facet-overflow's JSON (pipe: `node ap-facet-overflow.mjs |
node ap-sum.mjs`), not a probe — run it bare and it sits on stdin
forever; a serial battery that includes it "hangs" with zero output
(wasted a 600 s timeout diagnosing this, 2026-10-09). Read a probe's
header comment before adding it to a battery; the header says how
it's invoked.
