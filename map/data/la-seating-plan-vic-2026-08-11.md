# la-seating-plan-vic-2026-08-11.json

The 60th Parliament's Legislative Assembly seating plan, dated 11 August 2026 — the
`60th-parliament-la-seating-plan-gallery-perspective-combined-11-august-2026.pdf`
linked from <https://www.parliament.vic.gov.au/assembly> (mirrored to
`.build/map/src/vic22-seating/la-seating-2026-08-11.pdf`). The only LA plan the
Parliament publishes; refreshed in place when a new one is posted, so keep this
file the earliest plan **after** the election for the vic22 frame's "as seated"
view (as the user asked: a version reflecting the seating map as soon as
possible after the election in the chamber view).

The PDF carries two pages of the same chamber: page 1 desks captioned by
electorate (with portfolio captions down the government column), page 2 by
member surname. Footer of both: "ALP 54 (53); L/Nat 29; Green 3; Independent 2"
— the Speaker (Maree Edwards, ALP) takes the chair, so 87 members occupy the
coloured desks and one sits in the chair.

## What is authoritative in here

- **Party blocs and every desk's bloc colour.** The desks are drawn as
  coloured boxes — 53 pale-green (ALP minus the Speaker), 29 pale-yellow
  (L/N), 3 orange (Greens), 2 pale-blue (Independent). The counts match the
  footer exactly, so the colour layer is the plan's own record.
- **The leaders' six seats.** The desks adjacent to the table fall into two
  clean stacks of three — the three nearest the table on the government side
  and three opposite — and the page-1 portfolio captions ("Premier",
  "Deputy Premier", "Leader of the House" / "Opposition Leader",
  "Nationals Leader", "Deputy Leader of the Opposition") anchor the order:
  Niddrie/Dandenong/Ivanhoe and Kew/Gippsland South/Caulfield.
- **Orientation.** Government's benches to the reader's left (the Speaker's
  right), opposition to the right, Greens and the two Independents outboard
  of them. The two independents' desks are the only pale-blue ones (the plan's
  own choice) at the opposition end of the chamber's head — their surname
  captions were re-homed to the bottom-right block in the 2026 re-seat, which
  is one of the tells for the text layer lagging the desk layer.

## What is derived (method, and care with it)

The surname/portfolio text layer sits on the desks with per-caption jitter
(±10–25pt, worse where the desks' leading edge is set in a tightening fan near
the Speaker) and a handful of grossly misplaced captions (the two Independent
surnames, and the top corner rows). Assignment was: anchor the robust
inliers (labels within ~24pt of a same-colour desk), fit the nearly-identity
affine the inliers share, then assign every member to a same-party desk by
proximity, and hand-adjudicate anything over ~30pt with the desk-row table and
the page-1 portfolio captions in evidence. Desk colours always constrained
party membership, so bloc-level placement is exact even where an adjacent
same-party pair could be transposed. Nepean is the one name the pairing pass
could not see (the winner changed at the May 2026 by-election — the plan
prints "Marsh"); the one unclaimed L/N desk takes him. Desks' `desk`
coordinates are the plan's page coordinates (A4 points, y down) for
traceability, not a geometry the app draws — the app draws its own
federal-style horseshoe and walks members onto it in chamber order.

Term changes written into the roster (the election's own as-elected list is
`res-vic22.json`): by-elections Mulgrave (Foster, ALP), Warrandyte (Werner,
LIB), Werribee (Lister, ALP), Prahran (Westaway, LIB), Nepean (Marsh, LIB);
party moves Ringwood (Fowles) and South Barwon (Cheeseman) to Independent.
The speaker stays Bendigo West (Maree Edwards), so no later-speaker lane.
