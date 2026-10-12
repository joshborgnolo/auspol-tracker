---
name: auspol-demographics-reminders-watch
description: auspol-tracker — the "reminders" watch for the HAND-ENTERED demographics houses (shipped 21c2e99, 2026-10-09): demo-watch.mjs watchReminders() + RM findings-cache signatures, DEMO_STATUS reminders array, the wrapper's REMIND bucket as a fifth failure class of the weekly crosstabs run, clearance by hand-entry or KNOWN_SKIP only (never loosen the constants), and the tag-strip gotcha (the findings cache is HTML — "NSW </strong>(n=765)" — so signatures run on stripped text; the pin test caught 10363's state tables NOT matching before the strip).
source: auto-skill
extracted_at: '2026-10-09T03:24:10.044Z'
---

# auspol-tracker: the demographics reminders watch (hand-entered houses)

Why it exists: Roy Morgan, Newspoll, Fox & Hedgehog and Freshwater breakdowns are
hand-entered blocks inside `.build/demographics.mjs` (`ROYMORGAN_DEMO`, `ROYMORGAN_STATE`,
`ROYMORGAN_COUNTRY`, `NEWSPOLL_DEMO`, `FOXHEDGEHOG_DEMO`, `FRESHWATER_DEMO`), so the
automated houses' stale/dropped alarms can never trip for them — which is how the
Apr–Jun 2026 Newspoll quarterly sat unentered for three months (published 3 Jul, filed
in October). The watch was built 2026-10-09 (commit 21c2e99) in response to "confirm the
agents get this data wherever it appears".

## Machinery (four homes + one test)

1. **`.build/demo-watch.mjs`** — PURE module (no fs/network), pinned logic:
   `watchReminders({ polls, waves, knownSkip, rmReleaseFor, now }) -> [string]`
   - (a) POOLED KEY-MATCH: a `"Newspoll (pooled)"` / `"Roy Morgan (pooled)"` row in
     polls.json older than `NP_POOLED_LAG_DAYS = 10` whose `pollster|date` key is in
     neither the wave set nor KNOWN_SKIP → "…: the aggregate row's printed breakdowns
     are unentered – hand-enter (NEWSPOLL_DEMO / ROYMORGAN_COUNTRY), or KNOWN_SKIP it…".
     Pure bookkeeping lag (the June quarterly's exact failure mode).
   - (b) NP CADENCE: newest Newspoll (pooled) row older than
     `NP_POOLED_CADENCE_DAYS = 110` (the quarterly habit) → "no quarterly aggregate in
     N days". Fires even when every wave is entered — it means a release was MISSED.
   - (c) RM PROBE: plain `"Roy Morgan"` poll rows within `RM_WATCH_DAYS = 45`, cache
     located via `rmFindingId(url)` (finding id → `.build/roymorgan-src/release-<id>-*.json`),
     matched against `RM_WATCH_SIGNS` (see below). No cache file → silent (watches
     recent arrivals only).
2. **`.build/demographics.mjs`** — thin caller: defines rmReleaseFor (fs scan of
   roymorgan-src), calls watchReminders with `now: new Date()`, prints one
   `reminder <text>` line per hit, and emits `reminders` in `DEMO_STATUS`.
3. **`.build/crosstabs-updater.sh`** — new `REMIND=""` bucket parsed from DEMO_STATUS
   (`"reminders":\[…\]`), log grep extended to `^\(pending\|dropped\|reminder\) `, and a
   gate after the UNKNOWN gate: non-empty REMIND → `exit 1` ("hand-entered houses'
   releases waiting on hand-entry or a KNOWN_SKIP mark"). Runs AFTER commit/push like
   the other gates, so landed work still ships.
4. **`.build/crosstabs-repair-prompt.md`** — failure class #4 documented under
   "Reading a reminder": this is hand-entry work, never a code fix; the three reminder
   forms and their resolutions; HARD RULE — REMIND clears only via block entries or
   KNOWN_SKIP, never via loosening NP_POOLED_LAG_DAYS / NP_POOLED_CADENCE_DAYS /
   RM_WATCH_DAYS or the probe signatures.
5. **`.build/test-demo-watch.mjs`** — pins (wired into package.json `test` immediately
   after test-crosstabs): signatures against the real committed caches
   (`release-10328/10333/10343/10353/10363-*.json`), pooled fire/clear + KNOWN_SKIP
   clearance, cadence counter, and the DEMO_STATUS shape — all with an injected
   `NOW = 2026-10-09` clock so the pins never rot.

## RM_WATCH_SIGNS — precision-only, and the tag-strip gotcha

```js
[/\bNSW\s*\(n\s*=\s*[\d,]+\)[^<>]{0,80}\bVic\s*\(n\s*=\s*[\d,]+\)/, "per-state subsamples …"],
[/(?:voting intentions?|primary vote)[^<>]{0,60}\bby (state|country of birth)\b/i, "a special demographic title …"],
```

Shapes the releases have ACTUALLY taken: finding 10363's state tables
("NSW (n=765), Vic (n=626)…") and 10341's "Voting Intentions by Country of Birth" title.

**GOTCHA that the pin caught**: the findings cache `content` is HTML — the real 10363
line is `<strong>NSW </strong>(n=765), <strong>Vic</strong> (n=626)`. The as-drafted
signature never fired. `rmSignsWhy()` therefore normalises:
`hay = [archiveName, archiveUri, content].join("\n").replace(/<[^>]+>/g, " ")` —
the `[^<>]{0,80}` span constraint survives because tags are gone from the haystack.
If you add a signature, pin it against the raw cache AND check the stripped form.

Signed-out deliberately: finding 10328's "Analysis by gender shows 60% of men and 58% of
women say Australia is 'going in the wrong direction'" is direction-prose, NOT a
demographic table — it must stay silent (pinned). A wave we say nothing about is a wave
we did not catch, never a wave checked; precision matters more than recall because
KNOWN_SKIP is the clearance mechanism (a false positive burns hand-check time; a false
negative is what it always was).

## Clearance protocol (the human/agent path)

A reminder resolves exactly two ways:
1. hand-enter the wave's table in the right demographics.mjs block (keyed
   `house|date` to match the reminder), figures re-read from the release itself; or
2. `KNOWN_SKIP["<key>"] = "<evidence>"` in demographics.mjs — "a wave checked by hand
   and found to carry no breakdowns". KNOWN_SKIP now clears BOTH the automated-house
   loop and the reminders (its comment says so).

Then `node .build/demographics.mjs` must print zero reminders, `node
.build/test-crosstabs.mjs`, `bash .build/crosstabs-updater.sh` (or the weekly CI run).

## Related

- auspol-demographics-reader (the pipeline this watches; KNOWN_SKIP/KNOWN_DROP/stale/dropped semantics for the AUTOMATED houses).
- auspol-demographics-hand-entry (the data-entry trap: data/demographics.json must die with the next run, entries live in demographics.mjs blocks).
- auspol-thinness-backfill (the OTHER data-completeness watchdog; same "adjudicate, never silence" discipline).
