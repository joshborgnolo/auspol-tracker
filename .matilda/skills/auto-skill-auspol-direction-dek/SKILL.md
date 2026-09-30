---
name: auspol-direction-dek
description: "auspol-tracker — the National-direction panel's head+dek generator (RdDirection in rd-panels.jsx ~:820-845; dek's NET framing shipped 464b57c, 2026-09-28, vivid-verb ladder added same day: 'Net mood has plummeted, down N points in a month and M points since May 2025') plus the net chip under the share bar ('▼ 5.4 on a month ago, within the margin' when changeSig is false — bcda719, 2026-09-30): now.chg/sinceFirst are NET changes (right minus wrong), netVerb grades plummeted/soured/soured slightly (up: soared/lifted/lifted slightly) by N>=10|6|<6 inside the changeSig gate only, netWord/upDown keep wording leadership-agnostic, rdRoughPts owns the election figure ('more than 30', never a hard-coded flat 30), the old-design DirectionPanel carries DIFFERENT legacy copy — the dek is a SINGLE home, not a two-homes pair. The 'within the margin' idiom is a site-wide promise (hero chip, Info guide) — keep every panel's insignificant-move chip on the same terse wording."
source: auto-skill
extracted_at: '2026-09-28T01:45:57.762Z'
---

# National direction — head + dek copy machinery

Live generator is `RdDirection` in `.build/newtracker/assets/rd-panels.jsx`
(~:820). Everything derives from `D.direction` (monthly means, `M`) and
`D.directionNow` (gen-data's current-reading block): `now.chg` = change on a
month ago, `now.changeSig` = the significance gate — **both measured in NET
points (right − wrong)**, like `sinceFirst = now.net - first.net` vs the
term's first monthly mean. `wrong`/`right` absolute shares feed `head`, the
scatter and the bracket, never the dek's direction words.

## The dek (NET framing 464b57c, vivid-verb ladder 3b2e60b, held-steady copy 41da3ef — all 2026-09-28)

User-confirmed full ladder (in their words): **plummeted → soured → soured
slightly → held steady → lifted slightly → lifted → soared** — the rungs
map to netVerb's down tiers, the insignificant-month sentence, and the up
tiers respectively.

Rendered when wrong-track leads:

> Only 23% say we’re heading in the right direction. Net mood has
> plummeted, down 10 points in a month and more than 30 points since
> May 2025.

Template at ~:835-845:

```js
const netVerb = (n, up) => n >= 10 ? (up ? "soared" : "plummeted")
  : n >= 6 ? (up ? "lifted" : "soured") : (up ? "lifted slightly" : "soured slightly");
const netWord = (d) => (d > 0 ? "improved" : "worsened");
const upDown  = (d) => (d > 0 ? "up " : "down ");
```

- Movement is spoken **in net terms** so the wording never depends on which
  answer leads. This replaced the pre-464b57c gap framing
  (`gapWord(d) = (wrongLeads ? -d : d) > 0 ? "widened" : "narrowed"` →
  "The gap between the two has widened significantly in a month, by N points,
  and by more than 30 since just after the 2025 election."). If a task says
  "the gap widened" copy still exists here, the old idiom was reverted or
  you're in the legacy renderer (below).
- **Verb ladder (`netVerb`)** — graded by N = `Math.round(|chg|)`, and it
  lives inside the `changeSig` branch only, so a vivid verb is always
  licensed by a significant move: N ≥ 10 → plummeted/soared; 6–9 →
  soured/lifted; < 6 (a just-significant move) → soured slightly /
  lifted slightly. Adverb goes AFTER the verb (user correction: not
  "slightly soured"). The 6/10 cuts are arbitrary room-giving bands —
  tune in `netVerb` if copy-review says so; `netWord`
  (improved/worsened, no ladder) still words the rare `chg == null`
  election-only sentence.
- Branches: `chg == null` → no month clause; `changeSig` →
  "Net mood has ‹verb›, down N points in a month" (N = `Math.round(|chg|)`
  — the MONTH figure is an exact round, only the election figure uses
  rdRoughPts); insignificant → "Net mood has held steady for a month"
  (no vivid verb — the ladder lives inside the changeSig branch only).
- Election clause fires when `|sinceFirst| >= 5`: after a significant month
  with the same sign it renders bare `" and " + M + " points…"` (the down/up
  adverb carries); a month/term **sign flip** gets `" but up " + M + …` so
  false copy is impossible; an insignificant month gets `", though it is
  down " + M + …`; `chg == null` gets a standalone
  "Net mood has worsened, down M points since May 2025."
- `rdRoughPts(v)` (~:814) owns the ELECTION magnitude as "a count of points
  as a reader rounds it": <12 exact rounds, else tens with a ±2 band
  ("more than 30" for 32.x, "about 10". Do not flatten it to a user's quoted
  "30 points" — flag the deviation instead (see the workflow note); and the
  phrase is now "since May 2025", not "since the 2025 election".

## Workflow: user copy-edits against this generated sentence

Users quote the RENDERED dek loosely (they wrote "and 30 points since the
2025 election" when the live render said "more than 30 … just after"). Don't
string-replace the quoted sentence — map the request onto the whole template
family (both directions, all four branches), keep established helpers
(rdRoughPts, plainShare) over their literal flat figures, rebuild, and flag
each deliberate deviation in the summary. With the 464b57c refactor the only
direction-dependent phrase left is the "Only N%" lead-in (which needs
`wrongLeads`); future edits should not reintroduce `wrongLeads` into the
movement wording.

## The net chip under the bar (.rd-dir-net, ~:943-944 — qualifier shipped bcda719 2026-09-30)

"Net −39.0 points, ▼ 5.4 on a month ago" is a SECOND place the significance
gate shapes user-facing copy: when `now.changeSig === false` it now renders
", within the margin" on the tail. Gate it on `=== false` exactly — a
significant move gets no qualifier, and `changeSig` may be absent (gen-data
only sets it when the net nowcast's changeCi95 exists), so the loose
falsy test would misrename those panels.

Origin: the user hit Net −39.0 with a ▼ 5.4 month dip beside a dek saying
"held steady" and asked "should it say …, within the margin?" — the −5.4
was honest but well inside the change's own 95% band (changeCi95 was 10.9;
the direction series is three houses and sometimes one, the widest band on
the site, which gen-data's own comment says is the honest shape). The chip
is the exact spot the contradiction read, so the qualifier went THERE, not
into the dek.

"Within the margin" is the user's chosen terse wording — do NOT re-expand
to "…of error". It matches the established idiom elsewhere on the site:
- the 2pp hero's month chip (rd-panels.jsx `change` const, ~:103):
  `sig === false` → ", within the <RdTerm id='margin-of-error'>margin</RdTerm>"
  and `sig === true` → ", a significant rise/fall" (RdTerm lives in rd.jsx
  ~:522; the direction chip stays PLAIN text — RdTerm isn't imported there
  because the glossary opens from "two-party preferred" context).
- the old design's trend-chart tooltip title (a11e1559 ~:1663):
  "vs a month ago – within the margin".
- the Info guide's "Beside a figure in a panel" entry, which already
  promised: "When the move is smaller than its margin of error, the
  headline says 'within the margin'" — and lists national direction among
  those figures. Direction's chip was the gap making that copy false.

## Neighbour machinery that is deliberately NOT net-framed

- `head` (~:831): `plainShare(big) + " say Australia is " + …` with
  ", the most this term" ("Australia", not "the country", since 2026-09-28;
  the quoted-question string at ~:891 and the legacy panel below keep the
  pollsters' "the country").
- Right-edge bracket (~:860s, `brackets`): "N.N points apart in ‹Month›" /
  "up from M.M in ‹base›, before Bondi" — GAP (distance-between-lines)
  framing, which the net-framed dek does not replace; don't "align" the two.
- Footer (~:899): house-credit counts ("Most readings are ‹top›'s weekly
  poll: n of the m since May 2025") plus, since 2026-09-28, a DATED stop
  clause for inactive houses — "‹House› became inactive in ‹Month YYYY›"
  off gen-data's `directionStoppedSince` (month after the last series
  reading; houses grouped by quiet-month). Machinery and convention live in
  the `auspol-house-credit-lists` skill.

## Single home — legacy panel is different copy

The old design's `DirectionPanel` (`a11e1559` ~:1383) returns
`<RdDirection>` when `window.AP.rd` — the live path. Its own legacy fallback
(~:1443-1460) is a different sentence family ("Wrong track has widened its
lead" head, "plShare(big) Australians (N%) now say the country is heading in
the wrong direction." dek) that is NOT kept in sync with the rd dek. Edit
rd-panels.jsx for the live copy; touch the legacy block only if the change
is explicitly meant for the old design too. Verify the rebuilt
`index.html` carries the compiled template by grepping it for
`Net mood` (ASCII — no babel-escape trap).
