---
name: same-file-edit-sequencing
description: Matilda edit tool — two edit calls against the SAME file in one assistant turn race and one edit is silently lost (the second call's write appears to be computed from the pre-edit buffer; its success result still prints, so nothing errors). Observed 2 Sep 2026: a windowItems insertion into sim-next-polls.mjs vanished when a cadSlip edit in the SAME block landed — caught only because the sim then printed the old ticker behaviour and 6 expectations failed. Sequence same-file edits one call per message, and after any multi-edit turn grep for one marker line from EACH edit. Inherited variant (2026-10-01): the damage outlives the turn — resuming a sibling's uncommitted WIP found four call sites of rdPinScrollBy/RD_SCROLL_TO with zero definitions in tree OR build (the authoring edit never landed); resume protocol = identifier-closure check on the dirty diff (grep usages vs definitions in working file + git show HEAD:<file> + repo), read the author's uncommitted auto-skill SKILL.md diffs in the same git status as the spec for the lost hunk, rebuild and grep the ARTIFACT for the definitions too, and smoke the user's pending manual step headlessly before handing it over.
source: auto-skill
extracted_at: '2026-10-01T01:00:15.147Z'
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

## Inherited variant: resuming a sibling's torn WIP (2026-10-01)

The clobber's damage outlives the turn that caused it. User asked to
resume a sibling session's uncommitted Safari-pin instrumentation
(rd.jsx): the working tree AND the rebuilt index.html both carried FOUR
call/log sites of `rdPinScrollBy(drift)` and `RD_SCROLL_TO` with ZERO
definitions anywhere — the authoring edit for the helpers never landed,
nothing had errored, and the user's pending manual step (paste a console
snippet against localhost) would have hit a first-pin ReferenceError.

**Resume protocol for uncommitted WIP (sibling or own compacted session):**

1. **Identifier-closure check on the dirty diff.** `git diff` the modified
   source, list every identifier the diff *uses* that the diff doesn't
   define, and grep each one through (a) the working file, (b)
   `git show HEAD:<file>`, (c) the repo. A usage with no definition in any
   of the three = a lost edit, exactly the pattern above. Nothing clinches
   it by absence of errors — the file reads fine in isolation.
2. **The author's own uncommitted skill notes are the spec.** The dirty
   set included the sibling's freshly-updated auto-skill SKILL.md whose
   history paragraphs described the intended-but-missing scaffolding
   ("?rdscroll=to A/B routes the two correction sites through scrollTo vs
   scrollBy") precisely enough to re-derive the lost hunk. Read the skill
   diffs in the same `git status` before writing anything.
3. **Check the BUILT artifact too.** index.html had already been rebuilt
   onto the torn source and carried the same holes — after repairing the
   source, rebuild and grep the artifact for the definitions, not just
   the usages.
4. **Smoke the user's pending manual step headlessly first.** A
   one-click probe (`.matilda/dbg-pin-taps.mjs`, Chrome headless against
   the localhost serve) was already in the sibling's scratch kit; running
   it — plus its A/B variant — proved both modes populate their log
   before telling the user to spend their turn in Safari's console.
