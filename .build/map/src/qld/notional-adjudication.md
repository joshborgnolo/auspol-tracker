# Queensland notional Labor-v-LNP 2PP — adjudication

Started 2026-11-19 (the states sweep of the NT notional-2PP programme).
sibling doc: .build/map/src/nt/notional-adjudication.md (template),
.build/map/src/vic/notional-adjudication.md (official-source precedent).

## The question

ECQ publishes per-district full preference distributions and (for
qld20/qld24) per-venue TCP counts, but no two-party products — no
notional majors counts anywhere. Asking whether the Electoral
Commission of Queensland runs alternative counts post-election (the
NTEC-2016 pattern) found nothing; Queensland has no official estimate
shared by any analyst other than Antony Green's.

## What's available

- **QLD2024_ResultSummary.pdf** (ABC's summary series, November 2024):
  Antony Green's per-district "Summary of Two-party Results by District"
  carries all 93 seats; rows superscripted **1** (estimate for the 2020
  election) and **2** (estimate for the 2024 election), per the note
  under the table. The eight districts whose 2024 final count wasn't
  LNP v Labor each carry one of those tags, so their majors figure is
  **his estimate** — provenance `estimated-green`, exactly the nt20/24
  class.(Filed: Hill, Hinchinbrook, Maiwar, Mirani, Noosa, South
  Brisbane, Southern Downs, Traeger. Bundamba's `1` tag already has a
  classic figure from its own count and files nothing.)
- qld20 and qld17's bare sets (8 and 28) await their OWN provenance
  sweep: AG did publish 2020 preference-flow tables (no per-district
  est-2PP surfaced yet in this session's sweep); if his 2020/2017
  summary PDFs exist in the same ABC guide family they're the lane.
  Nothing shipped yet for those frames.
- There is no candidate-absence problem on the Queensland frames (both
  major parties contest every district).

## Semantics

Identical to the shared contract: `tppn` on every majors figure from a
non-classic final; `tppe` only on estimated-green rows (all of qld's);
official-pair rows swing, estimated rows never do; the territory
aggregate mixes certified lanes with estimates (the "est. 2PP" print
and the frame's composition note carry the discipline). Filing sets
are closed pins, set-equality asserted in build_qld_common.
