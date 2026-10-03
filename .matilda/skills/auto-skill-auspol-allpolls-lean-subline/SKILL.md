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
