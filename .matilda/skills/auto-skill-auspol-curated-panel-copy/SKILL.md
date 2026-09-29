---
name: auspol-curated-panel-copy
description: auspol-tracker — the user's dictate-pattern for Snapshot panel copy ("change this copy to …" on a panel dek). FOUR forms now: FREEZE the generator into a hand-curated static string (RD_DEMO_HOME convention; issues trustDek c1b1fb3), RE-LINK the frozen skeleton's figures to the live payload (vote-switching dek d59d855), TRIM the generator ("keep only the first sentence" — delete the appended-sentence block, leave the kept sentences dynamic; undecided dek a6f2e60), or COMPOSE dictated phrase-pieces around a data payload ("…keeping the titles and deks dynamic to changing statistical significance" — Who-votes trend block: curated RD_TREND_* pieces + gen-data §7gb demoTrend payload, shipped 2026-09-29). VERIFY every factual claim of dictated copy against the live pooled data BEFORE shipping and flag mismatches ("2.5 times" vs pooled 2.75, corrected on follow-up). Keep heads/rows data-driven, keep null-guards, record the curation in-source and in the panel's skill. Expect the "is it dynamic?" follow-up — state the drift trade-off proactively.
source: auto-skill
extracted_at: '2026-09-28T09:30:49.812Z'
---

# Dictated panel copy: freeze the generator, verify first

## Trigger and pattern

The user quotes a rendered dek on a Snapshot panel and dictates a replacement
verbatim ("change this copy to …"). The established response (three panels and
counting — vote-by-group headlines, then on 2026-09-28 the issues Who's-trusted
dek and the vote-switching dek) is to REPLACE the copy generator with a
static curated string, marked with the RD_DEMO_HOME convention comment:

```jsx
/* Hand-curated dek (user's wording, <date>), same convention as
   RD_DEMO_HOME: refresh by hand when the pooled … move — it no longer
   regenerates. */
const dek = !top.imp ? null
  : "The cost of living is by far …";
```

Keep the null-guards (`!top.imp`, `!lnp || !alp`) so the dek drops out
rather than lie when its data class vanishes. Everything else in the panel
stays data-driven: the headline above the dek, trend sentences, row
figures, agreement bars. Only the dictated sentences freeze.

## BUT verify the dictated claims against the live pool first

The user dictates wording, not data literacy — a claim can be stale or
rounded oddly. Before shipping, probe the pooled payload in the BUILT
index.html and confirm every quantitative claim; if one misses, flag it in
the reply and ship the dictation anyway (it is theirs), unless they said
"in line with the data" — verdicts so far: ship verbatim, note the gap
("2.5× dictated; pool says 2.75× — flag it"), then expect a follow-up
retune commit ("make it say 2.75 then").

Probe recipes (node one-liner, brace-matching slice):

- `const onSources = {…}` — vote-switching rates: `S.series` entries carry
  `rate.now.v`/`ci95`, `S.weights` carry 2025 shares.
- `const issues = {…}` — per-issue `I.list`: `.imp.v` (top-3 salience),
  `.own.v{alp,lnp,onp}` + `.leadSig`/`lead` (significant pooled lead).
- `const demographics = {…}` — `.tabs[i].sets[j].groups[k]` with `v`, `ci`.
- Brace-match from `html.indexOf("const onSources = {")` forward, then
  `JSON.parse(slice)` — regex `.match(/(\{.*?\});/s)` mis-cuts on nested
  payloads; the brace-walking slice is the reliable extractor.

Confirm BOTH directions: each new claim (e.g. "Labor leads on housing" —
newly significant that day) and each claim the dictation silently drops
(e.g. national security's old Coalition mention — correctly absent, it had
gone n.s.).

## Typos in dictation

A dictated sentence may carry a transposition ("they'd for vote One
Nation"). Repair minimally — keep every dictated word, fix only the order
("they'd vote for") — and state the repair in the reply. Do not silently
rewrite, and do not block shipping to ask about a one-token typo.

## Where this copy lives (and its twins)

- Live deks are in `.build/newtracker/assets/rd-panels.jsx` (rd-* renderers).
  Grep a distinctive phrase of the CURRENT dek across `.build` to find the
  generator IIFE (e.g. `trustDek` ~:1707, vote-switching `dek` ~:1409).
- Check for twins before shipping: `build.mjs` buildStaticSummary (the
  static-article view) and the legacy a11e1559 renderers (`issDek` etc.).
  The legacy card defers when the redesign is on
  (`if (window.AP.rd) return <RdIssues …/>`), so its own generated wording
  stays as-is — leave it truthful, don't freeze it.
- Rebuild (`node .build/newtracker/build.mjs`), then grep the BUILT
  index.html for an ASCII-safe fragment (babel escapes curly typography —
  `they’d` is `\u2019`; grep "flocked to One Nation", not "they’d").
- Record the verbatim frozen copy in the panel's skill
  (auto-skill-auspol-issues-panel, auto-skill-auspol-vote-switching-panel)
  with the curation note — the per-panel skill is where the next session
  looks when the pool moves on.
- Commit explicit paths (generator asset + skill + index.html) and push;
  races are routine (two landed mid-session on 2026-09-28) — see
  ci-main-writer-races for the rebase-with-autoStash + zero-drift recipe.

## The "is it dynamic?" follow-up

After the second freeze the user asked whether the dek was data-linked —
they care about drift. So when shipping a freeze, state the trade-off in
the reply: the figures are now fixed strings that will hold as waves land,
hand-refresh per the convention; and offer the alternative — same curated
wording with the NUMBERS computed live from the payload
(`timesWords(hiC.rate / loC.rate)`-style helpers still exist and are used
by the legacy renderer). If they choose re-linking, keep the curated
sentence skeleton and interpolate the figures; do not resurrect the whole
old generator.

### The re-link, chosen (d59d855)

The user chose re-linking for the vote-switching dek ("re-link … everything
should be linked but rounded, of course"). Implementation in rd-panels.jsx
RdSwitching: sentence skeleton kept verbatim as a string template, every
token interpolated — party names follow whichever of lnp/alp rates higher
(`hiC/loC`, nm() mapping), ratio = `Math.round(rate * 4) / 4` (nearest
QUARTER, rendering numerals like "2.75" — not timesWords' worded
nearest-half, the user wanted the numeral), share = `plainShare(rate)`
("Almost two in five"). Verify the rendered values against
`const onSources = ` in the built page before pushing (lnp 38.2 / alp 13.9
→ 2.75). Also answer the natural next question — "are the OTHER panels'
heads/deks dynamic?" — with the per-panel split (Who-votes: dek sentences
dynamic via demoVerdict + outlier gate `Math.abs(d) > ci`, but the pinned
RD_DEMO_HOME headline is the same frozen regime; offered dynamicising it is
a bigger design call — claims dropping out breaks the sentence shape).

## Worked examples (2026-09-28)

- **c1b1fb3** — issues trustDek frozen to the user's three sentences; all
  claims verified against `const issues` (CoL 70% top-3 = "by far" vs
  housing 37%; housing newly SIG for Labor; national security correctly
  dropped). Generator helpers left in place (chTop/trTop/minor still feed
  the data-driven head).
- **be7af47 → cbdf1db → d59d855** — vote-switching dek frozen ("flocked to
  One Nation … 2.5 times"), retuned to 2.75 on the user's data-alignment
  follow-up, then RE-LINKED on "everything should be linked but rounded":
  same skeleton, figures interpolated (see §The re-link, chosen).
- **a6f2e60** — undecided dek TRIMMED to its verdict sentence (see §The
  trim, a third form); the Roy-Morgan range quartile block and the
  conditional latest-pooled-figure tail deleted from RdUndecided's story
  IIFE, kept sentence left dynamic off withinHouseSlope.

## The fourth form: composed phrase-pieces around a payload (2026-09-29)

The Who-votes trend block was dictated as five full per-party title+dek
texts, plus the clause "keeping the titles and deks dynamic to changing
statistical significance". That is not a freeze and not a re-link: the
copy becomes a COMPOSITOR. The dictated shapes survive as curated
phrase-pieces (`RD_TREND_*` maps — "losing voters faster in", "The
composition of …'s vote is unchanged", the skew tails, the
eastern-mainland collapse) while WHICH pieces fire, and every figure, is
computed per build from a gen-data payload (§7gb `demoTrend`: the
two-stage proportionality-tested moves). Dictation governs the grammar;
the data governs which grammar fires. Machinery detail lives in
auto-skill-auspol-vote-by-group-headlines; the weighting lesson
(margins-not-n → 1/se² precision weights) in
auto-skill-group-trend-proportionality.

A same-day 2026-09-29 follow-up correction moved the compositor's home:
its first mount sat directly under the panel's curated headline, but the
user's dictate had meant the change-over-time slot BETWEEN the dot-plot
card and the monthly charts, so the shift IIFE's render came down and
the slot's prior per-tab compositor (a `sub` IIFE cutting 25
Age/Gender/Home gap pairs — "The age gap has widened as One Nation has
grown" et al., figures user-verbatim per tab) was RETIRED with its
RD_DEMO_NOUN map; see auto-skill-auspol-vote-by-group-headlines's
trend-block section.

Two consequences worth keeping:

- The dictation snapshot and the corrected statistics can disagree — the
  examples here had been written against junk-weight runs. When flagged,
  the user chose data-corrected dynamics: compositor output outranks the
  snapshot wording, and choice-varying items (an ONP renters move going
  away and coming back) may legitimately flip the TITLE between
  "unchanged" and "shifting" build to build.
- The regression probe asserts mechanics (window opener, branch
  selection, hedging, quoted figures ⊆ payload levels), never the exact
  words — see .matilda/demo-trend-probe.mjs.

## The trim, a third form (a6f2e60)

A TRIM dictate ("keep only the first sentence from this copy: '…'") is NOT
a freeze: the kept sentences stay GENERATED, only the sentences the user
didn't quote are cut. Implementation on the Undecided panel
(rd-panels.jsx RdUndecided story IIFE):

- The quoted dek is computed text, so find the generator by grepping the
  STATIC tail sentences ("mostly run between" / "the latest pooled
  figure"), not the kept first sentence — though in this case the kept
  sentence's static stem ("Neither share has" / "moved significantly
  since the 2025 election") was also greppable.
- Surgically delete the block that appends the unwanted sentences
  (`dek += " Undecided voters have mostly run between …"` plus its
  house-quartile preamble `house`/`hp`/`q`/`last`), flip `let dek` →
  `const dek`, and leave a dated comment ("user trim, 2026-09-28") so the
  next session doesn't read the shortened dek as a regression.
- Verify the BUILT page BOTH ways: the kept fragment still appears
  ("moved significantly since the 2025 election" ×1) and every trimmed
  phrase is gone ("mostly run between" ×0). When a trimmed-adjacent
  phrase still matches (grep -c found "pooled figure" ×1 AFTER the
  trim), inspect its ±100-char context BEFORE assuming the edit missed —
  it belonged to the issues panel's own copy ("…pooled figures in Who's
  trusted"), not to the dek. Babel escapes curly quotes in built JS, so
  grep ASCII-safe stems.
- No twin generators existed (grepped all of .build), but check anyway —
  see §Where this copy lives.
- The trimming removed a conditional in-pagenumber format branch
  (`u.toFixed(1)` direct numeral); the remaining dek now renders only
  fraction-worded shares, which is consistent with the site convention of
  avoiding small-print numerals in prose (see the RoundNum/fraction
  conventions elsewhere). Mention side-effects like this in the reply.
- Validate before committing (`node .build/newtracker/validate.mjs`),
  commit ONLY the owned paths (sibling sessions leave dirty files in the
  tree — stage rd-panels.jsx + index.html explicitly), and expect a push
  race: `git push` rejected here (non-fast-forward); the
  ci-main-writer-races recipe fixed it —
  `git -c rebase.autoStash=true pull --rebase origin main`, rebuild,
  confirm `git status --short index.html .build/newtracker/assets/` is
  empty (zero drift), push again.
