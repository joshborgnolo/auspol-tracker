---
name: auspol-curated-panel-copy
description: auspol-tracker — the user's dictate-pattern for Snapshot/section copy ("change this copy to …" on a dek). EIGHT forms now: FREEZE the generator into a hand-curated static string (RD_DEMO_HOME convention; issues trustDek c1b1fb3), RE-LINK the frozen skeleton's figures to the live payload (vote-switching dek d59d855), TRIM the generator ("keep only the first sentence" — delete the appended-sentence block, leave the kept sentences dynamic; undecided dek a6f2e60), COMPOSE dictated phrase-pieces around a data payload (Who-votes trend block, 2026-09-29), SWAP the head and dek's roles while keeping every figure computed ("undo this reversal. but make the title … So a sort of title/dek reversal. but keep it all dynamic" — RdSwitching 2026-09-30, shipped as a git-revert + reframe in ONE commit 3caa1c3), GATE a dictated conditional clause on its own significance test (Decidedness by-party sub's ", while One Nation voters have hardened" tail, fd7f474 2026-10-01 — renders only while ON's move stays significant; the dictated full sentence did NOT render at ship time, verify the gate against the payload and report the ACTUALLY-RENDERING sentence), RESTRUCTURE a dynamic generator to the dictated SENTENCE ORDER while keeping every figure computed AND freezing it across a control state (Past-cycles summary finding 2026-10-02 — "keep it dynamic … this is the copy regardless of whether All past terms / Re-elected / Ousted is selected"; storyFor dropped its cmp/tail machinery and ranks the full past-term set always; machinery in auto-skill-auspol-cyc-summary-finding), or UN-FREEZE a hand-curated string back into a dynamic generator when the user calls it out as static ("this text isn't dynamic. make it dynamic" — issues trustDek, 2026-10-05: the curated sentence shapes survive as gated clauses; staleness the freeze had already accrued — housing's lead gone non-significant — surfaced at un-freeze time and was user-adjudicated). VERIFY every factual claim of dictated copy against the live pooled data BEFORE shipping and flag mismatches ("2.5 times" vs pooled 2.75, corrected on follow-up). Keep heads/rows data-driven, keep null-guards, record the curation in-source and in the panel's skill. Expect the "is it dynamic?" follow-up — state the drift trade-off proactively.
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
- **2026-10-05** — issues trustDek UN-FROZEN (the eighth form, see §The
  un-freeze): the curated string is now a gated generator again; housing
  left the Labor list (lead not significant, user-approved) and will
  re-enter by itself.

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
  "unchanged" and "shifting" build to build. A related user paste (five
  dictated title+dek pairs) is a payload-DEPENDENT INSTANCE of the
  compositor, not five static copy versions — the shapes live in the
  RD_TREND_* phrase-pieces and recompose per build (heads shifted when
  the payload stopped flagging the moves the paste quoted, e.g. the ALP
  non-English sentence and QLD/VIC state flags).
- The 2026-09-29 significance gate ("it must be significantly
  significant to make it"): a thin move (≤7 monthly points) never
  CARRIES a claim — only solid moves rank sets and make heads; a thin
  move trails a solid one as a hedged "appears to …" sentence (max two,
  one per set, none from sets the solid claim already carries), and an
  all-thin party renders the unchanged pair with no trailer.
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

## The sixth form: a significance-gated dictated clause (fd7f474)

2026-10-01, Decidedness by-party sub-head. The user dictated
"Coalition voters have softened while One Nation voters have hardened
since July 2025 — keeping it dynamic, e.g. if One Nation's softness
ceases to have changed significantly, just say 'Coalition voters have
softened since July 2025'" (then reordered the clauses in the same
message: "actually make it: 'Coalition voters have softened since July
2025, while One Nation voters have hardened'"). The replacement is not a
freeze, re-link or compositor: the dictated sentence becomes a TEMPLATE
whose OPTIONAL tail clause fires only while the panel's own significance
test flags the underlying move:

```js
const onpRow = rows.find((r) => r.id === "onp");
const onpTail = onpRow && onpRow.sig && biggest && biggest.id !== "onp"
  ? ", while One Nation voters have " + (onpRow.now < onpRow.base ? "softened" : "hardened") : "";
const sub = biggest ? … + " since July 2025" + onpTail : "No party’s voters have softened significantly since July 2025";
```

Lessons that hold for any new gated clause:

- **The dictated full sentence is a POSSIBLE RENDER, not today's render.**
  Reproduce the gate against the live payload BEFORE shipping and quote
  the sentence the user will actually see: on 2026-10-01 only lnp was
  significant, so the page said "Coalition voters have softened since
  July 2025" — the dictated "; while One Nation…" tail was correct to be
  SILENT (ON's 51.8→56.2 move sat inside its pooled margins). The user's
  fallback example exactly described the current render. Recipe (window
  shim on the data asset) is in
  auto-skill-auspol-decidedness-panel.
- **Significance kinds must match the panel's**, not a fresh test of
  your own devising — here `aparat` on gen-data's pooled ci95s (3-wave
  pools both ends), i.e. the very `r.sig` the by-party rows already
  carry; reuse the row's computed flag rather than re-deriving it.
- **De-duplicate against the lead clause**: when the tail subject is
  itself the biggest mover (`biggest.id === "onp"`), the lead clause
  already names it — the tail must NOT append a second mention.
- **Direction verbs ride the same switch as the lead** (softened/firmed
  from now<base), even when the user names a single direction in their
  example — they sense-check the today's-wording, not the grammar.
- When the dictation also renames a temporal anchor ("mid-2025" →
  "July 2025"), grep for the old wording ACROSS the panel — the same
  window is named by the ShiftPlot source line and dot key (left
  as-is by scope, flagged in the reply). The exact-dates key
  ("Mid-2025 (19–30 Jun to 25 Sep–7 Oct)") is generated and stays
  authoritative; the nominal phrasing is what moves.

## The un-freeze, an eighth form (issues trustDek, 2026-10-05)

The reverse of the freeze: the user quotes the curated string and says
"this text isn't dynamic. make it dynamic". The curated wording stays the
SHAPE — every sentence survives as a clause — but each clause gates on
the live payload, so the copy regenerates from the data it once froze.
Worked on the Who's-trusted dek (`trustDek` in RdIssues' story IIFE,
rd-panels.jsx; the c1b1fb3 string replaced by an IIFE, still rendered
via `dek: trustDek`):

- **Staleness first, before writing a line of generator.** A frozen
  string accrues drift the day it ships — the whole point of un-freezing
  is that the pool has moved. Reproduce every claim of the curated text
  against the CURRENT payload and adjudicate the mismatches with the
  user BEFORE coding: on 2026-10-05 the frozen dek's "Labor leads on
  housing" had gone non-significant (38.9 vs 34.5), so the dynamic
  version drops housing today (user approved the drop) and re-enters it
  by itself when the lead re-signifies. The first render of the new
  generator is therefore NOT the quoted string — say that in the plan.
- **Franchise the wording's editorial calls into gates.** Every judgement
  baked into the curated string needs an explicit rule, and each rule is
  a user decision where it changes today's render (ask, don't assume —
  three were asked here): ordering of issue lists (SALIENCE order, so
  the frozen "crime and immigration" renders "immigration and crime");
  the "by far" intensifier's gate (kept: ≥1.5× the runner-up AND ≥10pts,
  with a new "where ‹party› holds a clear lead" clause for a significant
  top-issue lead); and lore words like "age-old" (user: the Coalition's
  HISTORICAL perception on economic management — gate only on the
  current significant Coalition lead, no this-term tenure check; other
  Coalition leads ride the same sentence as ", and leads on …" rather
  than earning a fourth sentence).
- **Run-on discipline:** cap who-says-what at two parties per sentence
  joined by ", while "; a third party starts its own sentence (the
  probe's "no double-while" check pins it). Sentence-initial parties use
  the capitalised display form (`rdPartyStart`), mid-sentence the
  article form (`rdPartyIn`) — "Labor leads …, while One Nation leads
  …. The Coalition retains …".
- **Null-shape guards ride along from the freeze era:** no `own` block
  on the top issue drops the trust clause (never invent "no party is
  more trusted" without data); no `imp` on the top issue drops the whole
  dek (`null`), same contract the generator had before c1b1fb3.
- **Pin with a compiled-source probe, not a copy of the JSX:**
  `.matilda/probe-issues-trustdek.mjs` brace-walks the compiled IIFE out
  of the built index.html, evaluates it against the live payload plus
  ten payload mutations (each gate and each dropped clause), and asserts
  the exact live render. Seventeen checks — the live string plus every
  flip: housing re-entry, trust-clause swap, age-old gain/loss,
  double-while ban, by-far gate, null drops.
- **Leave the framework intact for a RE-FREEZE.** The head (`trustHead`)
  stayed data-driven through the freeze and the un-freeze; either
  direction of curation touches only the `trustDek` binding, one hunk.

