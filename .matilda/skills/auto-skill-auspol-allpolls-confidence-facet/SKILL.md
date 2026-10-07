---
name: auspol-allpolls-confidence-facet
description: auspol-tracker — the All-polls CONFIDENCE facet (?f=c, 7th facet; row set shipped 4328ee3, lane-constant sample column 4b15150, PER-RELEASE Sample + Fieldwork columns 5adfeb5, all 2026-10-07; user's brief "the home of the data used in the economic mood chart") end-to-end: gen-data.mjs confidenceOnlyPolls emitter + CONF_LANES lane tuples (~:2438, reads the SAME data/mood.json as the Snapshot mood panel — releases not polls, so like issuesOnlyPolls/directionOnlyPolls the facet REPLACES the row set with empty p:{}/appr:{} stubs and threads the "release/releases" noun through pinbar, count, CSV aria, empty state, sheet and chevron labels; no scope pill, no poll counts), the shared 40–120 meter with neutral-100 emphasised (NAB prints its true net balance, drawn +100), printed change + NAB conditions riding the change cell, sortable Figure/Change, month rows "N releases", and the Sample + Fieldwork columns' PER-RELEASE provenance law (data half committed 3fc015f + f9c2b9b): a row's figure is the release's OWN printed number (mood.json row.n, read off its release by .build/mood.mjs — ANZ 1,019 / RM Business 1,094 / NAB ~507 land per release), the tuple slot-5 constant stands in ONLY where a house prints one (Westpac–MI's 1200 adults), else an honest em-dash; field = fwLabel(row.fwStart–row.fwEnd), business rows print their survey MONTH (row.fwm → "Apr '25"), and year + conditional fmid keys ride every row (a missing year prints "'de" — renderer contract). Also the where-things-stand head/dek law (fixed 2026-10-07): the rebuild's RdHed renders on EVERY facet by design, but its window is computed from the facet's row set, so on this row-REPLACING facet it silently vanished — the window reads D.individualPolls here (probe conf-headline.mjs pins head/dek parity with the 2PP facet incl. ?f=c deep links). Also the paired "Economic mood" → "Economic sentiment" rename contract (visible copy moved, every identifier frozen).
source: auto-skill
extracted_at: '2026-10-07'
---

# All-polls Confidence facet — the economic-sentiment releases as table rows

The mood panel's four published gauges (ANZ–Roy Morgan consumer weekly,
Westpac–MI sentiment monthly, Roy Morgan Business Confidence monthly, NAB
Monthly Business Survey) also exist as an All-polls facet — the seventh tab,
letter `c`, right after the others in FACETS (so also in the rdTabs arrow-key
walk). Data pipeline upstream is NOT this skill's: that is `auspol-mood-panel`
(extractor `.build/mood.mjs` → `data/mood.json`, four lanes). This skill is
the facet layer: emitter, row shape, render contract, sample column.

## gen-data emitter — confidenceOnlyPolls (gen-data.mjs ~:2432)

- Follows the **releases-not-polls** precedent exactly
  (directionOnlyPolls / issuesOnlyPolls): one row per release of a lane,
  empty `p:{}` / `appr:{}` stubs so nothing downstream can stand VI
  numbers on it, `client` = product line, `pollster` = byline.
- The facet REPLACES the archive row set (it does not join poll rows), so
  it has NO scope pill and NO poll counts; the noun **release/releases**
  threads through pinbar, count, CSV aria, empty state, sheet and chevron
  labels. "N releases" is also the monthRow count phrasing.
- Lane table is a const of tuples, extended to FIVE elements when the
  sample slot landed in 4b15150 (slot 5 became the constant FALLBACK
  under the 5adfeb5 per-release law — `r.n ?? sample`):

```js
const CONF_LANES = [
  ["consumer",        "ANZ–Roy Morgan", "Consumer Confidence", 100, null],
  ["westpacConsumer", "Westpac–MI",     "Consumer Sentiment",  100, 1200],
  ["business",        "Roy Morgan",     "Business Confidence", 100, null],
  ["nabBusiness",     "NAB",            "Business Confidence",   0, null],
];
//  destructure: [k, by, product, vs, sample]
//  fields: [mood.json key, byline client, product line, neutral anchor,
//           constant sample fallback (house prints ONE constant)]
```

The emitter comment documents the per-release provenance law and WHY
Westpac's 1200 is the only non-null constant (verbatim boilerplate in
every bulletin; the other houses print per-release or average figures) —
keep it current if a house ever standardises its print.

## Render contract (both classic + redesign, kept NICE-parity)

- Printed figure drawn at NICE parity (round to nearest integer as the
  source prints).
- Shared **40–120 meter** with the neutral-100 tick emphasised; every
  lane's figure plots on it, NAB included — NAB is a true net balance
  (0 = neutral) and is **drawn +100** (so −8 sits at 92) while every
  label/tooltip prints the TRUE published figure. Same shift discipline
  as the mood panel's plot (smooth(x+c) ≡ smooth(x)+c) — a constant
  display shift, never a data rewrite.
- Printed **change** beside the figure; NAB's conditions figure rides the
  change cell (`cond` / `condChg` on the lane payload), never a fifth
  column.
- Detail expansion draws a mini of TRUE printed values over the lane's
  history (raw prints, not the panel's smoothed line).
- Desktop row is the 9-track grid, including a real **Sample** column
  (header rendered from 4328ee3); sortable Figure and Change columns;
  search haystack includes client/product strings so "westpac" /
  "consumer sentiment" find the rows.
- `sampleCell` (rd-allpolls.jsx ~:2145) was already generic:
  `p.sample != null ? p.sample.toLocaleString() : "—"` — plumbing a new
  sample needs ONLY the CONF_LANES tuple slot, no renderer edit.

## Sample + Fieldwork columns — PER-RELEASE provenance law (5adfeb5)

The law graduated 2026-10-07 (user call: "add sample sizes … fieldwork
date range should also be added"). A row's Sample figure is the release's
OWN printed number — `row.n`, read off each release's own source by
`.build/mood.mjs` (data half 3fc015f + f9c2b9b, enrichment seams in
auspol-mood-panel). The tuple slot-5 constant now stands in ONLY where a
house prints ONE reusable constant (Westpac–MI's bulletin boilerplate
"The survey is conducted by OZINFO & DYNATA… based on 1200 adults" —
verified against primary sources, every bulletin); anything else is an
honest em-dash. **Never an invented constant, never an average standing
in for a wave's n** (RM Business's "Average monthly sample over the last
12 months = 1,159" is exactly the trap the f9c2b9b grader rejects).

Emitted keys (emitter ~:2438):

- `sample: r.n ?? sample` — per-release first, lane constant fallback.
- `field` / `dateLabel` — `fwLabel(r.fwStart, r.fwEnd || r.date)` when
  the window was read ("28 Sep–4 Oct"); a business row with only its
  survey month prints `monthName(row.fwm)` ("Apr", showing "Apr '25"
  under non-date sorts); else the release-date fallback `fwLabel(null,
  r.date)`.
- `fmid` — conditional on fwStart (`fmidIso`); the renderer everywhere
  reads `p.fmid || p.released` (rd-allpolls.jsx), so rows without a
  window just omit the key.
- `year` — rides EVERY row unconditionally: renderer fieldTxt is
  `p.field + " '" + String(p.year).slice(2)` under non-date sorts, so a
  missing year prints the broken `"…'de"`. Check for this string when
  adding any new facet row.

Verified live figures after 5adfeb5: latest ANZ–RM consumer 1,019
("based on 1,019 interviews", 2026-10-06 release), RM Business 1,094
(Sep 2026 wave), Westpac rows still 1200 via the constant, NAB and
Any-unenriched rows an em-dash. `sampleCell` needed NO renderer edit —
`p.sample != null ? toLocaleString : "—"` was already generic; fieldTxt
and the fmid consumers were likewise already in place (the whole change
is gen-data + dataset only).

**Bundle-probe note:** verify in the dataset
`.build/newtracker/assets/9f09dca2-*.js` with `grep -oE` + `wc -l`
(`grep -c` counts LINES and prints 1 on the one-line bundle —
auspol-bundle-data-probe's pinned gotcha). `"sample":1200` = 18
(Westpac term rows); enriched rows show their own n (e.g.
`"sample":1019`, `"sample":1094`); `"sample":null` shrinks as
enrichment lands (110 before 5adfeb5). The `confidenceOnlyPolls` line is
the only changed dataset line on a gen-data-only edit. A lane-TUPLE-only
tweak changes no rendered copy in `index.html` (ship gen-data.mjs +
dataset, index.html byte-identical); the 5adfeb5 emitter change DID
change index.html (new year/fmid/sample/field keys inline in the page's
embedded dataset) — verify its `git diff HEAD -- index.html` is
confined to those key names before committing (worked: a sibling
session's rebuild leaked live rd-allpollls WIP into the built page
mid-commit; see auspol-clean-artifact-commit's shelve-rebuild recipe).

## The where-things-stand head/dek law (fixed 2026-10-07)

The redesign's All-polls headline+dek ("Labor's 51.4 comes from seven
polls…" + the margin-of-error dek) is a **facet-independent**
where-things-stand line: `RdAllPolls` renders `{head && <RdHed …>}` on
every facet (the pinAp comment at rd-allpolls.jsx ~:2519 documents this
as load-bearing for scroll stability), but its source window was
`win = rows.filter(inToday)` over the FACET's row set. This facet
REPLACES rows with releases (no 2PP fields → `inToday` never passes →
`win` empty), which made the headline silently VANISH on this facet
alone — no error anywhere, the `<RdHed>` just isn't there. User call
2026-10-07: keep it identical to the other facets. Fix:
`const win = (facet === "confidence" ? D.individualPolls : rows).filter(inToday)`
(rd-allpolls.jsx ~:1833). `D.individualPolls` is the seed of the mapped
`rows` on every poll facet, so the computed text is byte-identical in
every branch (kalman/trend wording, resp/imp basis, lnp/onp matchup);
section chrome (`.rd-title` "Economic sentiment", `.rd-meta`) untouched.

Pin: `.matilda/probe/conf-headline.mjs` (13 checks) — tab walk to
Confidence at 760/1366px asserts head+dek equal the 2PP facet's, deep
link `?f=c#allpolls` asserts them on first paint, chrome still reads
"Economic sentiment", and a SOURCE pin
(`src.includes('const win = (facet === "confidence" ? D.individualPolls : rows)')`)
catches the edit being reverted (it caught the 2026-10-07 sibling
stash-park, see shared-repo-session-race). **Any future facet that
replaces the row set with non-poll rows must be added to that
source-selection ternary** — it inherits the same silent-vanish failure
mode. The classic view (d1a1d215) has no such head/dek line to fix.

## The paired rename contract (same commit 4328ee3)

User call: "call the economic mood section 'Economic sentiment' rather
than 'Economic mood'". Moved: the Snapshot panel h2, the classic
(static-summary) fallback h2, the All-polls/archive eyebrow-nav label,
and RdFoot's glossary reference. FROZEN identifiers — do not "consistency
rename" these: anchor `id="mood"`, CSS `.rd-mood`, the `s-mood` class,
and the glossary TERM id `mood` (its visible text can change; its id is
a cross-target of term-to-term xrefs). `auspol-mood-panel`'s title is
the panel-data side of the same rename.
