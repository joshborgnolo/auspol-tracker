---
name: same-file-edit-sequencing
description: Matilda edit tool — two edit calls against the SAME file in one assistant turn race and one edit is silently lost (the second call's write appears to be computed from the pre-edit buffer; its success result still prints, so nothing errors). Observed 2 Sep 2026: a windowItems insertion into sim-next-polls.mjs vanished when a cadSlip edit in the SAME block landed — caught only because the sim then printed the old ticker behaviour and 6 expectations failed. Sequence same-file edits one call per message, and after any multi-edit turn grep for one marker line from EACH edit.
source: auto-skill
extracted_at: '2026-09-02T06:10:00.000Z'
---

# Same-file edits must be sequential, not parallel

## What happened

While re-syncing `.build/newtracker/sim-next-polls.mjs` (commit `0cb9908`),
one message carried TWO `edit` calls against that file:

1. Insert the `isWindowRow`/`windowItems` ticker mirror (≈+24 lines into
   `ticker()`).
2. Insert the `cadSlip` base definition further down the file.

Both tool results reported success with file views that showed each edit in
place. But the second call's line-count report (467) only added up against
the ORIGINAL 461-line file plus its own +6 — i.e. it was computed from the
pre-edit-1 buffer. The next sim run printed the OLD ticker behaviour
("DemosAU 8 days (maybe)" where the window-row policy says DemosAU is off
the bar; 6 expectations FAILED), and re-reading the file showed edit 1 was
simply not on disk — edit 2's write had won.

Nothing errors. Both results print "success". The only witness is the
downstream behaviour contradicting what you just "changed".

## Rule

- **One edit call per file per message.** If a turn needs N edits to the
  same file, issue them across N messages, each after the previous result
  lands. Edits to DIFFERENT files in one message are fine.
- The failure is silent, so **verify after any multi-edit turn**: `grep -n`
  one distinctive line from EACH edit and confirm all of them are on disk
  before running tests. A green tool result is not evidence the edit
  survived.
- Symptom radar: a behaviour a just-applied edit should have changed is
  unchanged, and the total line counts in edit results don't chain
  (edit 2's baseline + its own delta ≠ edit 1's reported total).

## Why this saves more than it costs

The lost edit here was re-applied as three sequential calls and everything
went green immediately. The cost of sequencing is one extra round-trip per
edit; the cost of the clobber was a full confused debug loop that could
just as easily have been burned "fixing" perfectly correct expectations
against a file that silently reverted.
