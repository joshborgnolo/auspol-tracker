---
name: auspol-vote-by-group-headlines
description: auspol-tracker — the "Who votes for whom" panel headline is now a CONSTANT per party (RD_DEMO_HOME in rd-panels.jsx, right after RD_DEMO_SHORT, shipped 0d91b2e on 2026-09-28; grn and alp lines amended same day to an "urban or provincial" non-rural trait — BOTH inversions RETIRED 2026-10-02, the inversion having been designed before the lines grew "; less likely" tails: alp "…under 55, university-educated, and inner-metro; less likely to be rural or live in the eastern mainland states, especially Queensland", and grn — recut twice the same day, band-for-generation after the inversion fix, on a probe of the day's pool — "…Gen Z, women, and renting; less likely to be rural or TAFE- or trade-qualified" (Gen Z +20.7±4.3 SIG beats the 18–34 band's +12.4; Millennials flat): one hand-curated sentence per switcher party ("One Nation voters are more likely to be …"), refreshed BY HAND from the current pooled significances; the per-grouping finding sentence that used to BE the headline now leads the dek ahead of the two-form figures sentence (contrast when a split is significant, ONE shared fraction when not — shipped e87f1f9 after the ONP gender trap, where independent rdFraction snaps drew a 2.0pt pool as a 5-point "about three in ten … against one in four" gap). Switcher DEMO_PARTIES = FIVE chips since 69f467e (2026-09-29): oth joined as "Others" (short chip label; PARTIES.oth.name stays "Others / Ind." for table cells) with a curated oth RD_DEMO_HOME line, and the phone chip row wraps 3-over-2 at ≤480px because five chips+swatches overflow one nowrap row. oth's RUNNING-PROSE name is lowercase "others/independents" and its supporters "voters for others/independents" (user dictate 2026-09-29) — five name constants split across the a11e1559 asset and rd-panels plus a pName/pPoss plumbing in RdDemographics (s-ending name takes a bare ’ possessive; rdCap at sentence starts); PARTIES.oth.name "Others / Ind." still owns table cells, chip label "Others". Curate against window.AUSPOL.demographics with the panel's own simple |g.v − all| > g.ci margin test (NOT demoVerdict's Holm correction). ONP line was re-dictated 2026-09-30 (8ca5756) to the "more likely to be X, Y, and Z; less likely to …" shape: significant positive traits first, significant negative-side traits cast as "less likely to" verb phrases after a semicolon ("less likely to live in Victoria or speak a language other than English at home") — the pre-restyle inversion compounds "English-only-speaking" and "non-Victorian" are GONE, and oth's line was assimilated to the same shape ("…NSW-based; less likely to live in provincial areas or have a mortgage"); alp/lnp/grn untouched at that pass. A SECOND 2026-09-30 pass, under the user's restated rule "keep the copy here in this section dynamic, of course" (the margin test is a CONTINUING obligation — a listed trait that loses pool significance comes OUT at any curation pass, checked whenever the section's copy is touched or the pool is otherwise in doubt): alp gained "; less likely to live in the eastern mainland states, especially Queensland" (user dictate, anchored Qld −3.5±3.0 SIG + Rest-of-Australia +4.4±3.4 SIG on that day's pool; NSW +0.2±3.2 and Vic −0.5±2.6 flat, so the collapse rides Qld + the inversion), oth's "NSW-based" was DROPPED as pool-killed (+1.3±2.1 no longer SIG — shipped oth line reads "…Gen Z and renting; less likely to live in provincial areas") and "or have a mortgage" was DROPPED editorially despite still-SIG −2.3±1.7, as entailed by the kept "renting" +2.3 (user: "sorta entailed by more likely to be renting, so it doesn't add much information"). A THIRD same-day pass (user dictate) gave lnp its own "; less likely" tail — ", Victorian" (+2.6±2.5 SIG) into the positives and "; less likely to live in an outer metro" (−3.4±2.3 SIG) — the line is now "Coalition voters are more likely to be 55+, university-educated, inner-metro, Victorian, and outright homeowners; less likely to live in an outer metro". A FOURTH same-day pass: grn gained its own tail "; less likely to be TAFE- or trade-qualified" (TAFE −3.2±1.9 SIG on the day's pool), and lnp prose took the definite article everywhere — a second pName special case in RdDemographics ("the Coalition" → pPoss "the Coalition's") — and likewise grn ("the Greens" → "the Greens'", the bare-apostrophe path), so findings render "The Coalition's vote is much the same across the states / men and women", "The Greens' vote falls with age", and deks "…back the Coalition / the Greens" (DEMO_VOTE_FOR and RD_TREND_NAME already carried both articles). No trailing full stops on these constants, even when a dictated paste carries one. A FIFTH pass (2026-10-01, commit e916a4e) made the dek's outlier sentence sweep the st0 set too when demoVerdict reports noDiff: st0+st1 margin outliers merge by snapped fraction ratio one sentence per ratio-group (lnp/Place now reads "Inner-suburban voters and Victorians are the outliers, at one in four" — reconciling the curated "Victorian" headline trait with "much the same across the states"), with the merge key's snapRatio deliberately DUPLICATING rdFraction's candidate list (change both together). The composition TREND block IS the change-over-time head/dek slot between the dot-plot card and the monthly charts (RdSub at rd-panels.jsx ~:1447, relocated same date from under the panel headline — user correction 2026-09-29, see the trend-block section) is wholly GENERATED from gen-data §7gb's demoTrend payload (two-stage proportionality test, shipped 2026-09-29): curated RD_TREND_* phrase-pieces at ~:1006-1032, the shift IIFE compositor at ~:1119-1217, probe .matilda/demo-trend-probe.mjs. Since 2026-09-30 the shift dek's significance sentences carry a RELATIVE-POINTS parenthetical (user dictate: "after statements of significance … say '(−x points relative to all Labor voters)'. and then if there's a second … say '(−y points)'"): stateDek appends "(−x points relative to all Labor voters)" quoting the POLE (away) side's strongest move — never bestOf over the whole set, that quotes the complement ("the rest of Australia" +5.6 when named pole Qld moved −2.8) — and groupDek's lead/deficit sentence appends bare "(−y points)" = the change in gap; relPts(m) = (g1−g0)−(a1−a0) sits with sgnPts beside pct (~:1147-1150). Regression probes .matilda/demo-head-probe.mjs and .matilda/demo-oth-copy-probe.mjs, rel-points probe .matilda/verify-dek-relpoints.mjs (gitignored).
source: auto-skill
extracted_at: '2026-09-28T07:14:51.777Z'
---

# Who-votes-for-whom: constant curated headline per party

## What and why

Until 2026-09-28 the RdDemographics headline was computed per grouping
tab (Age / Gender / Education / Place / Home): every tab flip retitled
the panel ("One Nation's vote climbs with age" → "…is much the same
across men and women" → …). The user asked for a STABLE title with the
retired per-tab titles integrated into "the pre-existing dek texts",
supplied One Nation's line verbatim — "One Nation voters are more
likely to be 55+, TAFE- or trade-qualified, English-only-speaking,
rural, and non-Victorian" — and, invited to choose, picked HAND
curation for every switcher party over auto-generation. (That ONP
wording was itself re-dictated on 2026-09-30, commit 8ca5756, to the
two-part "more likely …; less likely to …" shape — see the structure
convention in "Curating the lines" below; the inversion compounds
"English-only-speaking" and "non-Victorian" no longer ship.)

## Machinery (.build/newtracker/assets/rd-panels.jsx)

- `RD_DEMO_HOME` sits directly below `RD_DEMO_SHORT`: now FIVE
  entries {onp, alp, lnp, grn, oth} — oth joined 69f467e (2026-09-29)
  when the panel gained its fifth chip. The story IIFE returns
  `head: home || finding`, so a party added without a curated line
  gracefully falls back to the old computed-title behaviour.
  DEMO_PARTIES (a11e1559 ~:2121) labels oth "Others" — the SHORT
  form: "Others / Ind." stays PARTIES.oth.name for table cells, but
  five full chips won't fit a phone row (see the chips-wrap section
  below).
- The per-grouping `finding` (the OLD headline text) is now PREPENDED
  to the dek: `{finding}. {figures sentence}. {optional
  outlier sentence(s)}.` An empty figures case degrades to
  `{finding}.` alone.
- The figures sentence has TWO forms (2026-09-28): the top/bottom
  fraction contrast ("…back One Nation, against one in six 18–34s.")
  when the set HAS a significant split, and — when demoVerdict returns
  "no significant difference" — ONE shared fraction for the whole set
  ("About one in four men and women alike back One Nation."). The
  contrast form rounds each group up/down to its nearest speakable
  fraction, which can draw a gap twice the real one as a difference
  (28.1 v 26.1 → "three in ten" v "one in four") — the shared form
  avoids contradicting the finding. People-named `all` words ("men and
  women", "owners and renters") get "{frac} {all} alike back X.",
  other sets "{frac} of every {one} back X.".
- Rendered by RdHed → `#who-votes .rd-hed` (<h3>) and
  `#who-votes .rd-dek` (<p>). Facet tabs change only the dek and the
  plots; party chips morph everything.
- The curation comment on the map (repo convention, mirrored on
  RD_DEMO_SHORT in the anchor skill) states every listed trait must be
  a significant gap in the current pool, refreshed by hand when the
  pool moves.

## Curating the lines

Significance = the simple margin test the panel's own st1-outlier
sentence uses, NOT demoVerdict's Holm correction. The outlier sentence (2026-09-30, noDiff st0 sweep; prose collapsed
2026-10-01 after the user flagged "X is the outlier. Y is the outlier."
back-to-back as poor prose): when noDiff it collects st0 groups whose
|g.v−all| > g.ci alongside st1's, deduplicates by label, and groups by
rdFraction's ratio key. ONE ratio group renders as before ("{labels}
are/is the outlier(s), at {fraction of the largest-|d| member}" —
lnp/Place's Victoria +2.6 SIG pairs with inner-suburban into
"Inner-suburban voters and Victorians are the outliers, at one in
four"); TWO OR MORE ratio groups render as a single sentence, "The
outliers are A, at x; B, at y; and C, at z." (semicolons whenever an
item carries its own "and" or there are 3+ items, else a comma-and) —
lnp/Age renders "The outliers are Gen Z, at one in eight; Boomers, at
about three in ten; and Millennials, at one in six." MAINTAIN-IN-PAIR: the merge key's `snapRatio` (story IIFE,
rd-panels.jsx ~:1322) DUPLICATES rdFraction's candidate-fraction list
(rd.jsx ~:692) deliberately — grouping must key on the pure ratio
"1/4", never on rdFraction's rendered string, because the "about"
hedge (drop threshold err < 0.012) differs between members of one
ratio (Vic 23.8 borderline vs inner-metro 25.9 bare) and would split
a matched pair into two sentences. Change one list, change the other.
Probe the pooled
payload via vm (the 9f09dca2 bundle —
.build/newtracker/assets/9f09dca2-….js, NOT the repo-root assets/
which is the shipped shell dir and never contains it; two failed
probes on 2026-09-28 before this was pinned — sets window.AUSPOL, not
window.D — see auto-skill-auspol-vote-by-group-all-voters-anchor's
probe section), or regex-extract `const demographics = {…}` from the
built index.html where the layer is inlined (recipe and its caveat in
auto-skill-auspol-bundle-data-probe):

- T = window.AUSPOL.demographics; per tab → set → group:
  d = g.v[party] − T.all[party]; significant when |d| > g.ci[party].

The payload's exact shape, whichever extraction route (pinned
2026-09-28 after three no-match shell probes guessed it wrong): TOP
LEVEL IS ONLY {"all": {<party>: share}, "tabs": [...]} — tabs is an
ARRAY of 5, not a keyed map, so filtering Object.keys(T) for entries
with a .sets shape finds nothing. Walk T.tabs[i] ({id, sets}) →
tab.sets[j] ({id, groups}) → g = st.groups[k] ({id, v, ci}); locations
live in the Place tab's `location` set as groups inner-metro,
outer-metro, provincial, rural. The regex-extraction route:
html.match(/const demographics = (\{.*?\});/s) — the interpolation is
already plain JSON, so JSON.parse(match[1]) directly (no eval).

Write POSITIVE-side traits ("more likely to be X"), using inversions
only where the negative side is the significant one (e.g.
"non-Victorian" because Vic is the only state significantly BELOW the
anchor; Labor's "under 55" because 55+ is significantly below).

The 0d91b2e set and its significance basis (all-voters in parens):
- onp (27.3): 55+ +6.7 · TAFE +5.7 · English-only +1.0 — NOT
  significant as an absolute margin; kept because other-language is
  significantly below (−7.5) and the group is too small to move the
  average (user's explicit reasoning, directing it stay) · rural +10.4
  · non-Victorian (Vic −3.1, the only sig-below state; Qld-vs-NSW is
  inside subgroup noise — Qld leads in only 14/25 waves, mean edge
  0.7pt ≪ ±3–4.5).
- alp (26.8): 55+ −5.0 → "under 55" · University +3.8 · urban-or-
  provincial — all three non-rural groups sit above the anchor (inner
  metro +4.0 SIG, outer metro +1.6, provincial +3.1) and rural is
  −10.6 SIG below, the same non-rural inversion as grn; the wording
  was extended from the grn line at the user's direction 2026-09-28,
  replacing the "inner-metro" trait the inner-metro +4.0 alone
  supported. SUPERSEDED 2026-10-02 (same user dictate as the grn
  fix): the non-rural inversion retired here too, restoring
  "inner-metro" to the positives and moving rural into the tail the
  state clause already sits in → "…university-educated, and
  inner-metro; less likely to be rural or live in the eastern
  mainland states, especially Queensland". True but unused:
  Rest-of-Australia +4.7 (SIG) — since promoted, see the 2026-09-30
  pool reading.
- lnp (21.3): 55+ +4.2 · University +4.3 · inner metro +4.5 · own
  outright +8.1.
- grn (13.2): 18–34 +12.5 · women +1.7 · renting +5.1 · rural BELOW
  (−3.2*, the only location significantly below); inner metro itself
  is only +1.9, NOT significant, so words like "city" unsupported
  alone. The 0d91b2e wording cast the rural gap as the "urban or
  provincial" inversion (every non-rural group), designed BEFORE the
  lines grew "; less likely" tails — with the negative clause in
  place the inversion no longer made sense, so 2026-10-02 (user
  dictate) moved rural to the tail where its significance sits:
  "Greens voters are more likely to be 18–34, women, and renters;
  less likely to be rural or TAFE- or trade-qualified". The alp
  line's "urban or provincial" trait was retired the same day on
  the same reasoning (its own tail was already a state clause);
  see the alp entry. RECUT AGAIN later 2026-10-02 (user dictate,
  after probing the pool): the measured-band "18–34" trait gave way
  to "Gen Z" and "renters" recast as "renting" (oth's grammar) —
  the generation set's Gen Z cell is grn 33.9±4.3 v anchor 13.2
  (+20.7 SIG, the pool's strongest grn gap by ~4 CI widths) while
  the 18–34 band's +12.4±2.6 turns out to be entirely Gen-Z-driven
  (Millennials +1.6 flat) → "Greens voters are more likely to be
  Gen Z, women, and renting; less likely to be rural or TAFE- or
  trade-qualified". Gen Z (voter-clamped 18–29) sits wholly INSIDE
  every pollster's published 18–34 band — a subset inference, not
  the Gen-X straddle the age-vs-generation skill warns of — and
  oth's line already curated "Gen Z" as precedent. True but
  unused: other-language +3.6.
- oth (~14): curated 69f467e (2026-09-29) from the oth pool's few
  significant splits — Gen Z (15.7±3.5 v all 11.1), renting, NSW on
  the positive side; provincial and mortgage holders significantly
  BELOW. The oth story is evenness (it is the residual bucket), so
  the line mixes both directions: "Voters for others/independents
  are more likely to be Gen Z, renting, and NSW-based, and less
  likely to be provincial or mortgage holders" (line was
  "Others voters are more likely…" at 69f467e; renamed later on
  2026-09-29 per the prose-name dictate in the next section).

Do NOT build a generator for this: auto-generation was offered and the
user chose hand-written lines. If the pooled significances shift
enough that a listed trait goes non-significant, rewrite the line in
this map and nowhere else; the commit should cite the new pool.

## Pool reading 2026-09-30 (first dynamic refresh — the baseline to beat)

Restated by the user the day after the oth/ONP reshaping: "keep the
copy here in this section dynamic, of course" — the margin test is a
CONTINUING obligation on RD_DEMO_HOME, re-run whenever the copy is
touched or the pool moves (the dek and the RdSub trend block stay
fully GENERATED regardless; "dynamic" for the headline constants means
hand-refreshed to the pool, not hand-frozen). Full re-probe after the
2026-09-30 Essential wave, anchors onp 26.9 · alp 27.1 · lnp 21.2 ·
grn 13.2 · oth 11.5:

- onp — all five listed traits still SIG: 55+ +7.3 · TAFE +5.7 ·
  rural +10.3 · Vic −2.9 · other-language −7.9. No change.
- alp — existing three still SIG (55+ −5.3, University +3.7, rural
  −10.9 vs inner-metro +3.9); user's dictated addition anchored on
  Qld −3.5±3.0 SIG and Rest-of-Australia +4.4±3.4 SIG (NSW +0.2±3.2,
  Vic −0.5±2.6 flat) → "…; less likely to live in the eastern
  mainland states, especially Queensland". The Rest-of-Aus inversion
  claim was already noted as true-but-unused at 0d91b2e; it is now
  the line's second half. 2026-10-02 supersession: the "urban or
  provincial" positive trait (the non-rural inversion) retired per
  the alp-entry note above — inner-metro (+3.9 here) is the positive,
  rural (−10.9 here) joins the tail ahead of the state clause.
- lnp — four inherited traits still SIG (55+ +4.1 · University +4.3 ·
  inner-metro +4.7 · own outright +7.9); user's dictated addition
  later that day anchored on Vic +2.6±2.5 SIG and outer metro
  −3.4±2.3 SIG (NSW −0.9±2.2, Qld −1.4±2.7, Rest-of-Aus +0.1±3.0 all
  flat) → line gains "Victorian," and its first "; less likely" tail:
  "…inner-metro, Victorian, and outright homeowners; less likely to
  live in an outer metro". Singular "an outer metro" is the dictated
  wording (sister tails are plural). Note outer-metro-less-likely is
  a separate cell measurement from inner-metro-more-likely, not an
  entailment like renting/mortgage.
- grn — all four inherited traits still SIG: 18–34 +12.4 · women +1.7
  (men −1.6) · renting +4.7 · rural −3.5 (inversion). User-dictated
  addition later that day anchored on TAFE or trade −3.2±1.9 SIG
  (Year-12-or-less +1.2, University +1.2 both flat) → the line gains
  its own "; less likely" tail: "…renters, and urban or provincial;
  less likely to be TAFE- or trade-qualified" (dictated wording —
  trait phrasing borrowed from RD_DEMO_SHORT's "TAFE- or
  trade-qualified voters"). SUPERSEDED 2026-10-02: the "urban or
  provincial" inversion moved to the tail as "rural", and later
  the same day "18–34" → "Gen Z" (+20.7±4.3 SIG, the pool's
  strongest grn gap; Millennials +1.6 flat, so the band's +12.4
  lift is Gen-Z-driven) and "renters" → "renting" — see the
  0d91b2e-set grn bullet above for the final line.
- oth — Gen Z +5.3±3.9 and renting +2.3±2.3 still SIG, provincial
  −5.2 still SIG. POOL-KILLED: NSW-based (+1.3±2.1, was SIG at the
  69f467e curation) — dropped, line now "…Gen Z and renting; less
  likely to live in provincial areas". Editorial drop alongside:
  mortgage (still SIG −2.3±1.7) out as entailed by renting. True but
  unused from this reading: Rest of Australia −2.2 SIG, mortgage,
  Millennials +2.4 (±2.6, not SIG).

## The dek's figures sentence could outrun the finding (flagged and fixed 2026-09-28, e87f1f9)

Pre-e87f1f9 the dek's top/bottom figures sentence was emitted for
EVERY grouping tab — even one whose finding was "no significant
difference" — quoting each extreme group's share via rdFraction
(rd.jsx ~:157), which snaps each value INDEPENDENTLY to the nearest
candidate fraction from a fixed list. When the two snaps diverged, the
displayed gap far exceeded the pool. Worked case, ONP gender tab: men
28.1±1.7 vs women 26.1±1.6 (all-voters 27.3; true gap 2.0pt;
demoVerdict's pair test z≈1.68, p≈0.09 → "One Nation's vote is much
the same across men and women") — yet the dek's second sentence read
"About three in ten men back One Nation, against one in four women", a
5-POINT display gap flatly contradicting the finding above it. Two
rdFraction mechanics to know before trusting the contrast form (still
the emitted form on sets WITH a significant split):

1. each group snaps independently, so rounding errors stack in
   opposite directions (28.1 snapped UP to 3/10, 26.1 DOWN to 1/4);
2. the "about" hedge drops out when the snap error is under 0.012 —
   26.1 rendered "one in four" BARE (err 0.011), implying an exactness
   a ±1.6 pool doesn't have.

demoVerdict for reference (a11e1559 asset, demoVerdict): z =
1.96·(vₐ−v_b)/hypot(ciₐ,ci_b) per pair, Holm-corrected across all
N(N−1)/2 pairs. The shipped fix (e87f1f9, the user picked the first of
the two offered): the no-difference figures sentence quotes ONE SHARED
fraction for the whole set — "About one in four men and women alike
back One Nation." See the "TWO forms" bullet in Machinery for the
resulting wording rules.

## oth's running-prose name: "others/independents" (user dictate 2026-09-29)

User quote: "replace 'Others / Ind.' with 'others/independents'. and
call them 'voters for others/independents'". Scope is RUNNING PROSE
only — the chip label stays "Others" (DEMO_PARTIES) and PARTIES.oth.name
stays "Others / Ind." for table cells; the rename lives in FIVE name
constants across the two assets, plus plumbing:

- a11e1559 asset: `DEMO_VOTE_FOR.oth` (~:2177, dek "back X" wording),
  `firmWho` oth case (~:1710, firmness panel noun), `ISS_WHO.Others`
  (~:2590, issues-panel group noun).
- rd-panels.jsx: `RD_DEMO_HOME.oth` (the curated line, now starting
  "Voters for others/independents …"), and the RdDemographics
  generator plumbing ~:1282 — one `pName = party === "oth" ?
  "others & independents" : party === "lnp" ? "the Coalition" :
  party === "grn" ? "the Greens" : P.name`
  feeds every finding/dek/aria template so future prose renames are a
  one-place change. The lnp branch joined 2026-09-30 on the user's
  dictate that Coalition findings carry the definite article ("The
  Coalition's vote is much the same across the states/men and women",
  "…climbs with age", "One in five … back the Coalition"), and the
  grn branch ("the Greens", possessive "the Greens'") followed the
  same day on "greens should also have a 'the'" — the s-ending name
  exercises the bare-apostrophe pPoss path. rdCap capitalises
  sentence starts. RD_TREND_NAME(_DEK) and DEMO_VOTE_FOR already
  carried both articles — the trend block and the verdict-form
  findings ("…to vote for the Coalition/the Greens") never needed
  the fix, and neither curated RD_DEMO_HOME line changes ("Greens
  voters are…" stays article-less in the headline).
- rd-panels.jsx groupLong (~:1858): the old
  `.replace(/^voters for other parties and independents$/, …)` mapping
  was REMOVED — ISS_WHO now emits the target phrasing directly.

Two grammar consequences of a LOWERCASE name worth keeping:

1. POSSESSIVE: `pPoss = pName + (/s$/.test(pName) ? "’" : "’s")` — an
   s-ending name takes the BARE apostrophe ("others/independents’
   vote"). (The user's example sentence happened to be written with
   the OLD name "Others / Ind.’s"; the bare form for the new name was
   flagged to the user, not yet confirmed.)
2. SENTENCE STARTS: findings and heads run through `rdCap` (rd.jsx
   ~:370) so a lowercase name still opens capitalised —
   `head: home || rdCap(finding)`, dek `rdCap(finding) + ". " + …`.

Verification: `.matilda/demo-oth-copy-probe.mjs` (gitignored) clicks
the "Others" chip over file:// index.html and asserts head
`#who-votes .rd-hed` starts "Voters for others/independents are" and
dek `#who-votes .rd-dek` carries "others/independents’ vote",
"back others/independents.", and never "independents’s". Probe
selector lesson (burned one run): read `.rd-hed`/`.rd-dek` TEXT off
`#who-votes`, don't guess sub-selectors — the same selector pair as
demo-head-probe.mjs.

## The trend block below it: composed, not curated (§7gb demoTrend, 2026-09-29)

Under the constant curated headline and its finding dek — between the
`rd-wv-dots` dot-plot card and the `rd-wv-charts` monthly charts — the
panel mounts its change-over-time head/dek pair, `{shift && <RdSub
head={shift.head} dek={shift.dek} glide />}` at rd-panels.jsx ~:1447.
(That slot is the change-over-time slot; a same-day user correction —
2026-09-29 — moved the composition-trend shift IIFE's render DOWN into it
from its first home directly under the panel headline, retiring with it
the previous per-tab change-over-time compositor, the `sub` IIFE
(~37 lines, deleted with its RD_DEMO_NOUN map), which had cut the same
25 Age/Gender/Education/Place/Home × onp/alp/lnp/grn/oth gap-pairs as
the live page had shown — "The age gap has widened as One Nation has
grown" and its sisters. The bloc's figures are now data-driven
compositions, not user-verbatim copied per-tab statistics.). Unlike the
curated headline it is fully GENERATED. The user dictated five
full per-party titles+deks, then said "keeping the titles and deks dynamic
to changing statistical significance", so the dictated shapes live on as
curated PHRASE-PIECES in `RD_TREND_*` (~:1006-1032, right after
RD_DEMO_HOME): name forms (RD_TREND_NAME/_DEK/_BARE), the no-move skew
tails (RD_TREND_SKEW, onp "Its older, regional skew…" / grn "Its younger,
urban skew remains."), state naming with the eastern-mainland collapse
(NSW+Vic+Qld → "the eastern-mainland states") and complement naming when
one side has no significant move of its own, location
adjective/reference pairs (RD_TREND_LOC), and the group prose forms
(RD_TREND_GROUP). The `shift` IIFE at ~:1111-1217 assembles sentences
from `D.demoTrend[party]` around those pieces.

Mechanics to know before touching it:

- §7gb (gen-data ~:2684, exported as window.AUSPOL.demoTrend and returned
  through the window list) runs the two-stage proportionality test per
  set×group×party — WLS slope of the group's gap from the all-voters
  anchor, re-fit on ln(group/anchor); only combos significant on BOTH
  reach the payload. Weights are the precision of each month's margin
  (rows carry no n — see auto-skill-group-trend-proportionality for the
  row[11] accident and the 1/se² fix). Moves on ≤7 monthly points carry
  `thin: true`.
- Sets rank by their strongest move's |t(log-ratio)|; the dek carries the
  top TWO sets and the head comes only from the first-ranked set —
  state → "… is losing voters faster in …", location → "… is gaining in
  …", anything else → "The composition of …'s vote is shifting".
- THE SIGNIFICANCE GATE (user dictate 2026-09-29, "it must be
  significantly significant to make it" — ONP's renters move, t 2.39 on
  7 monthly points, had displaced the dictated ONP unchanged text): the
  shift IIFE splits moves into solid (!thin) and thin. Only solid moves
  rank sets, carry claims and make heads; a thin move TRAILS the solid
  claim as a hedged "appears to …" sentence — groupDek's thin hedge,
  a single-sentence figureless locDek branch, and a hedged stateDek
  flag cover the set types — one sentence per set the claim doesn't
  already carry, at most two. No solid moves at all (none, or every
  move thin) → "… is unchanged" + the no-significant-move sentence and
  the party's RD_TREND_SKEW tail (skipped for parties without one),
  with NO trailing hedged sentence.
- Sentence figures are the payload's FITTED start→end levels, `pct()`
  capped at one decimal (since 2026-09-30 also the RELATIVE-POINTS
  parentheticals below — thin trailers quote only those, no
  start→end levels); later dek sentences pass rdCap so a lower-case
  party description still opens capitalised ("Others/independents'
  lead among …").
- RELATIVE-POINTS parentheticals (user dictate 2026-09-30: "after
  statements of significance in the dek … say '(−x points relative to
  all Labor voters)'. and then if there's a second … say
  '(−y points)'."). New helpers beside `pct` (~:1147-1150):
  `sgnPts(v)` = signed pct with a LITERAL − (U+2212, house style), and
  `relPts(m) = sgnPts((m.g1 - m.g0) - (m.a1 - m.a0))` — the move's
  points RELATIVE to the all-voters shift over the same window. Two
  attachment rules, worked against the live 2025-07-onwards payload:
  1. stateDek (the "composition … shifted away from X, and towards Y"
     sentence) ends "("+relPts+" points relative to all "+nameD+"
     voters)". Quote the POLE side: `bestOf(ms.filter(m => m.dir <
     0).length ? …dir<0… : ms)` — the away side's strongest move, and
     only if no away move is significant does the toward side
     contribute (that side IS the significant mover then). The first
     draft used plain `bestOf(ms)` and manufactured "…towards the rest
     of Australia (+5.6 points…)" — reading out the COMPLEMENT's
     number when the sentence and the head name Queensland (−2.8). A
     complement-named side ("the rest of Australia") has no move of
     its own and must never own the figure.
  2. groupDek (the "lead/deficit among X is growing" sentence — the
     dictate's "second") ends bare "("+relPts+" points)". relPts(m)
     there IS the change in gap, (g1−g0)−(a1−a0) ≡ gap1−gap0, so one
     helper serves both; shrinking/narrowing claims carry a POSITIVE
     number because the gap moved toward zero.
  locDek sentences were left alone (their second sentence already
  quotes absolute fitted levels "risen from X% to about Y%"). Thin
  trailers inherit both suffixes automatically — groupDek takes `m`
  and stateDek's hedged branch is the same function with `hedged`
  true; the user's "statements of significance" covers the "appears
  to" hedges too.
- With the corrected precision weights the rendered texts moved AWAY from
  the user's dictated examples where those examples had been written
  against junk-weight runs (onp gained a thin renters move, alp's
  language sentence dropped out); the user chose data-corrected dynamics
  over the snapshot wording when this was flagged, so the compositor's
  verdict stands.
- Probe: `.matilda/demo-trend-probe.mjs` (gitignored) clicks all five
  chips in the BUILT page and asserts MECHANICS against the live payload
  — the "Since {window} ," opener, unchanged-vs-shifting branch
  selection, thin hedging, every quoted % being a fitted payload level,
  and capitalised sentence starts — not a frozen word snapshot, so it
  keeps passing as significances move. Selector: the trend block is
  `#who-votes .rd-sub` / `.rd-subdek` (RdSub), distinct from the panel's
  own `.rd-hed` / `.rd-dek`. Run it after any §7gb or shift-IIFE change.

## Regression probe

BEFORE/AFTER dek diffs (worked 2026-10-01 for the st0 sweep): capture
the baseline with `.matilda/demo-lnp-dek-dump.mjs <parties>` (dumps
head+dek per chip × every grouping tab), make the edit, rebuild,
re-dump and eyeball the diff. To re-baseline against the PRE-edit
code after the edit is in the tree: `git stash` → rebuild → dump →
then `git checkout -- index.html` BEFORE `git stash pop` — the
baseline rebuild regenerates the tracked index.html, and popping the
stash over it fails "local changes … would be overwritten by merge"
(and `git stash pop` leaves the stash entry in place on failure, so
no work is lost; just discard the regenerated index.html and pop
again). Then rebuild once more to restore the post-edit page.

`.matilda/demo-head-probe.mjs` (gitignored: `.gitignore` has
`.matilda/*` with only `!.matilda/skills/` re-included) drives headless
Chrome over the built index.html and asserts, 21 checks:
1. head text equals the curated line for the default party across ALL
   five grouping tabs (reset to a non-default tab first — clicking the
   already-active tab is a no-op);
2. head per chip equals the curated line, chips clicked in
   DEMO_PARTIES source order (onp, alp, lnp, grn) — read the chip
   labels in the DOM to sanity-log they still render 1:1;
3. every dek is `{finding}. {figures…}` — asserted structurally (the
   figures sentence always contains " back "), not by wording, since
   the finding sentence itself varies per tab and per party.
