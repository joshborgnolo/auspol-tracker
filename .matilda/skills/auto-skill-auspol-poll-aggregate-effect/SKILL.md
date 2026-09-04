---
name: auspol-poll-aggregate-effect
description: auspol-tracker — the per-poll "2PP effect" provenance-band row (gen-data `eff` payload, EffLines; line shipped d10c376 → meta-band parenthetical 77dd1f3 → plain meta row 0ebf814): gen-data effByKey leave-one-out (house effects NOT re-estimated; out-of-window = ±0.0 + window note; ±4pt build throw), ONE shared component in a11e1559 rendered as an ordinary .pd-meta-i closing the meta band in BOTH renderers, eff spread in BOTH emitters (individualPolls + pollsterTable). Probe lesson: expand-row matching takes [pollster, field] as an ARRAY — pollster-only matching silently expands that house's NEWEST wave.
source: auto-skill
extracted_at: '2026-09-04T00:45:00.000Z'
---

# Per-poll aggregate-effect lines (auspol-tracker)

Shipped d10c376 (Sep 2026). Each expanded poll ends its two-party section
with "how much did this poll move the headline": a leave-one-out delta
between the standing aggregate and the aggregate recomputed without the
poll.

## Design rules (chosen deliberately — don't regress)

- **House effects are NOT re-estimated** without the poll; lean is a
  consensus property. Only the nowcast re-runs on rows minus one.
- **The delta is current-window by definition**: a poll outside
  `HL_WINDOW` (21d before `LATEST_ISO`) moves nothing, so its line reads
  `±0.0% · outside the 21-day window the aggregate covers` (a `vs
  monthly-mean` note instead if `m` set). Do not "backdate" effects to a
  poll's own era — the line answers "what pull does this row have on the
  number shown today".
- **Build guard**: gen-data THROWS if any single poll moves an aggregate
  >4pt — a landmine against a weights bug going out silently (mirror of
  the estimator guard philosophy; rule: never weaken it).
- Where each series compares: `lnp` vs `latest.alp2pp` (published 2PP);
  `imp` vs the synthetics nowcast `synthLatest.alp` (polls with no
  published 2PP — Newspoll, Freshwater); `onp` vs `altLatest.alp_on.a`
  (waves carrying an ALP-v-ON pair, additive second line).

## gen-data.mjs — `effByKey` (§3b, right after the `alt2pp` const)

- Rows carry `key = date+"|"+pollster` (added to `tppRows`,
  `tppRowsSynth`, `altRowsFor(field)` rows) — the map keys on it.
- Per poll, per series: drop the row, re-run the same estimator call,
  `eff[s] = {lo, hi, w, m?}` — `lo`/`hi` BOTH r1-rounded (round at the
  end: `const lo = est ? est.v : …` then `lo: r1(lo)`; a slipped
  pre-rounding asymmetry was a real bug in the first pass), `w` = in the
  21d window, `m` = vs-monthly-mean.
- **Emitted twice** — archive (`individualPolls`) and latest
  (`pollsterTable`) both spread `...(effByKey.has(key) ? {eff} : {})`
  AFTER the `tppFlows` spread. The two emitters must agree (probe
  asserts it); an edit to one is incomplete.

## UI — `EffLines({eff})` in a11e1559 asset

- Component sits right after `TppLine` (before `ApprLine`); rendered
  `{r.eff && <EffLines eff={r.eff}/>}` inside the FIRST `PdSec` (the
  `lead` one) AFTER the `tppLines` map — so no-2PP houses still show the
  section's "Not published" lead plus their implied line.
- Label order: `Effect on Labor's 2PP aggregate: ` /
  `Effect on Labor's implied 2PP aggregate: ` ("implied" is a hi-term
  glossary link to `implied-2pp`) / `Effect on Labor's 2PP aggregate vs
  One Nation: `. Signed move renders like ChgParen, true minus U+2212,
  `±0.0` for null; window note is a trailing clause, not a separate line.
- CSS `.pd-s.pd-s-eff` in template.html CLONES the `.pd-s.pd-s-basis`
  block (caption, `var(--pd-ink-2)`, `var(--pd-body)`, bold figures at
  `var(--pd-fig)`, word-spacing 2px) — its rules sit directly after the
  `.pd-s.pd-s-basis b` rule. Long lines are allowed to WRAP at 320px;
  the hero one-line guarantee doesn't cover them (pd-meta-hero probe
  only asserts the `.pd-s-hero` pair, which EffLines doesn't touch).

## Probe — `.matilda/probe/pd-eff.mjs`

Expands rows in both tables and asserts the rendered line texts against
the page's own boot payloads (`AUSPOL.pollsterTable` /
`AUSPOL.individualPolls`, never hardcoded figures). Current-window,
ON-two-line, implied, archive-newest, and out-of-window (w=0: ±0.0 +
window note + x==y) cases. **Learned the hard way (3 false-fails):**
row targeting must pass an ARRAY of strings AND-ed against row text —
`effLines(scope, [pollster])` matches that house's NEWEST wave (YouGov's
new row, not the targeted old one), and a "fall back to clicking by day"
rescue returned `null` while the check consumed the stale lines. Fix:
payload includes `field`, old-row calls use `[pollster, field]`.

## Verify + ship pattern

`node .build/newtracker/build.mjs` (validation throws print "validated N
polls…"), static payload invariants against the worktree index.html,
then probes with `INDEX_HTML=<worktree>/index.html` (pd-eff +
pd-meta-hero regression). Worktree pipelining + temp-index commit of the
(mine-only) files per auto-skill-shared-repo-session-race / MATILDA.md —
HEAD may advance mid-task under siblings, so `read-tree HEAD` fresh
right before `update-ref` with the expected-old-sha guard.
