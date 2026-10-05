---
name: auspol-allpolls-lean-subline
description: "auspol-tracker — the All-polls phone twopp card's second right-edge line ('House lean -0.3' under the figure) and the detail rail's four lean keys: user-dictated 2026-10-03 (label black/inherited, figure stays party-tinted; renamed from 'Usual lean', commit b293dc5). Anatomy rd-allpolls.jsx ~:1639-1657 + rd.css ~:2291-2305; the LABEL-BLACK/FIGURE-TINTED pattern (colour moves to an inner inline-styled span, outer class sheds colour and gets RENAMED if its name encoded the colour role: rd-ap-leanhl → rd-ap-cvalsub); the detail key is FOUR homes (issues/direction/leadership/twopp branches), grep the string to catch all."
source: auto-skill
extracted_at: '2026-10-03T10:54:08.169Z'
---

# All-polls phone card 'House lean' sub-line + the detail rail's lean keys

User dictate, shipped b293dc5 (2026-10-03): "make 'Usual lean' text black –
keeping the number itself coloured, and make it say 'House lean'", then
"rename the detail label too. push when done". The chosen name already
existed on the **House lean panel** (`id="house-lean"`, glossary
`house-effect` labelled "House lean" — see `auspol-house-lean-chart`), so
the card and detail now agree with the panel. Never reintroduce
"usual lean" in user-facing copy.

## The phone card sub-line (twopp facet only)

- **JSX**: rd-allpolls.jsx `RdAllPolls` twopp branch (~:1639-1657). The
  value is the latest point of `D.houseLean[<key>][pollster]` where
  `<key>` is `onpub`/`tpp` (published) or `onimp`/`imp` (implied) by the
  matchup — the same feed `RdApMini`'s "How it counts" dot strip uses
  (skill `auspol-allpolls-mini-dots`), so card and detail never disagree:

  ```jsx
  {hl != null && <span className="rd-ap-cvalsub">House lean <span style={{ color: rdApLeanInk(hl, onM) }}>{rdApSigned(hl)}</span></span>}
  ```

- **CSS**: rd.css ~:2291-2305 (inside the phone media block, after
  `.rd-ap-cvalsub`'s sibling `.rd-ap-cval`): the sub is
  `position:absolute; right:0; bottom:0; 11px/tabular` with the label at
  weight 400 (user call 2026-10-03: "the word house lean … should not be
  bolded") and a `> span` rule keeping the FIGURE at 600, inside a
  `.rd-ap-cpic` strip whose HEIGHT IS AN INLINE STYLE (`primStripH`,
  derived so the twopp card lands at exactly the primary facet's row
  height — contract pinned by a612cd4/055e117 the same day; the CSS only
  owns inside layout, never set the strip's height from CSS).
- **Row gate**: the sub renders only when the house has a lean point AND
  `primStripH` measured; otherwise the card is the bare `.rd-ap-cpic`.

## The label-black / figure-tinted pattern (the reusable move)

When the user says "make the text black, keep the number coloured" on a
previously all-tinted span:

1. **Colour moves to an inner `<span style={{ color: … }}>` wrapping
   ONLY the figure**; the outer span goes colourless so the label
   inherits the card's ink.
2. **Rename the class if its old name encoded the colour role**:
   `rd-ap-leanhl` ("lean highlight") no longer described a colourless
   shell, so it became `rd-ap-cvalsub` ("cval sub-line"). Then the CSS
   rule loses any `color` declaration.
3. **Verify in the BUILT index.html with BOTH greps at zero**: old copy
   AND old class name gone (`grep -c 'Usual lean' index.html` → 0,
   `grep -c 'rd-ap-leanhl' index.html` → 0), and the new pair present.
   Babel escapes unicode (see `auspol-built-html-verification`) — grep
   the plain-ASCII parts of new strings.
4. Comments that quote the user's original words ("add … 'Usual lean
   -0.3'") stay VERBATIM as call-record; only narrative comments update
   ("the pollster's house lean").

## The detail rail's lean key is FOUR HOMES, not one

`{p.pollster}'s house lean` appears in `RdApDetail` at four branches —
issues (~:1120), direction (~:1138), leadership (~:1176) and twopp
(~:1208). Each is its own `<span className="rd-apd-k">`; renaming means
four edits in ONE file (sequential edit calls — the same-file-edit race,
see `auto-skill-same-file-edit-sequencing`). Grep the full old string
`usual lean` across the asset directory before assuming you found them
all; the sed-all-then-read-back pattern is safest.

## The desktop twopp "House lean" COLUMN (shipped 2026-10-03)

User call: "there's no house lean column in the 2P facet of the All polls
table — add a 'house lean' column to the end … the column heading can be
wrapped if it can't fit". The redesign All-polls table's twopp facet now
ends with a House lean data column; the classic archive table (d1a1d215)
ALREADY carries its "House effect" (hfx) column and was untouched.

Homes (three — the four-homes column-surgery rule's fourth home, the
classic table, didn't apply):

1. `rd-allpolls.jsx` `colHead` twopp group, right after `th("Lean", …)`:
   a NON-sortable `<span role="columnheader" className="rd-ap-th r wrap"
   title="…">House lean</span>`. Deliberately not a `th()` sort key: the
   classic table's `hfx` sort measures per-house consensus deviation — a
   different quantity — so reusing a "house lean" sort key would cross
   the two tables' semantics, and wiring a new sort key means touching
   the AllPollsView `getVal` switch in d1a1d215 (cross-asset). The
   existing `.rd-ap-th.wrap { white-space: normal; line-height: 1.3 }`
   does the two-line wrap the user permitted.
2. `rowFor` — the hl derivation is HOISTED to rowFor function scope
   (one `let hl = null; if (facet === "twopp") …` block reading
   `D.houseLean[pub?(onM?"onpub":"tpp"):(onM?"onimp":"imp")][pollster]`,
   latest point `.v`), shared by BOTH the desktop cell
   (`hlCell = <span role="cell" className="rd-ap-hl" style={{color:
   rdApLeanInk(hl, onM)}}>{hl == null ? "—" : rdApSigned(hl)}</span>`,
   assigned in the twopp branch) and the phone card's sub-line. The
   desktop row JSX interleaves it:
   `{figs}{pic}{val}{facet === "twopp" && <>{hlCell}<span></span></>}`
   — the empty span is the filler-track occupant; row and hrow both
   carry 10 children now.
3. `rd.css` `.rd-ap-c2pp` grid-template-columns gains a fixed figure
   track INSIDE the 1fr spacer at all three desktop rungs: base 200px
   120px 76px 28px 150px minmax(0,400px) 64px **60px** minmax(0,1fr)
   40px; ≤1240px …56px **52px** minmax(0,1fr) 32px; ≤1000px …minmax(0,1fr)
   52px **48px** 0 28px. New rule `body.rd .rd-ap-hl { text-align:right;
   font-size:14px; font-weight:600; color:var(--ink); white-space:nowrap
   }` — the FIGURE never wraps; the wrap concession belongs to the
   heading alone.

Month rows (`rd-ap-mrow`) position by explicit grid-column spans, so the
9→10 extension needed no mrow edit. Phone is cards (`{phone ? phoneHead
: colHead}`) — hrow/rows don't exist ≤760px, no CSS rung there.

Pinned in `.matilda/probe/ap-usual-lean-sub.mjs`'s desktop-1280 block:
hrow 10 children with "House lean" the last heading cell
(hlIdx == leanIdx+1), header height >25px (wrapped), every row 10
children with `.rd-ap-hl` third-from-last, figures
`^(—|±|[+−-]?\d+\.\d)$` with no overflow, Essential's cell "−0.3"
matching the phone sub, all right edges equal, zero `.rd-ap-hl` / zero
"House lean" headers on the other four facets.
