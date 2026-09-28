---
name: auspol-vote-by-group-headlines
description: auspol-tracker — the "Who votes for whom" panel headline is now a CONSTANT per party (RD_DEMO_HOME in rd-panels.jsx, right after RD_DEMO_SHORT, shipped 0d91b2e on 2026-09-28; grn line amended same day to add "from cities"): one hand-curated sentence per switcher party ("One Nation voters are more likely to be …"), refreshed BY HAND from the current pooled significances; the per-grouping finding sentence that used to BE the headline now leads the dek ahead of the top/bottom figures. Switcher DEMO_PARTIES = four chips (onp/alp/lnp/grn, no oth). Curate against window.AUSPOL.demographics with the panel's own simple |g.v − all| > g.ci margin test (NOT demoVerdict's Holm correction). ONP line is user-verbatim ("55+, TAFE- or trade-qualified, English-only-speaking, rural, and non-Victorian") — "English-only" kept per user override. KNOWN UNRESOLVED TRAP: the dek's top/bottom figures sentence snaps each group's share independently via rdFraction and can DISPLAY a far wider gap than a non-significant pool has (ONP gender case: true 2.0pt gap rendered "about three in ten … against one in four"). Regression probe .matilda/demo-head-probe.mjs (gitignored).
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
curation for every switcher party over auto-generation.

## Machinery (.build/newtracker/assets/rd-panels.jsx)

- `RD_DEMO_HOME` sits directly below `RD_DEMO_SHORT`: exactly four
  entries {onp, alp, lnp, grn} — DEMO_PARTIES renders four chips and no
  "oth" chip, so there is no oth line to write. The story IIFE returns
  `head: home || finding`, so any future party added without a curated
  line gracefully falls back to the old computed-title behaviour.
- The per-grouping `finding` (the OLD headline text) is now PREPENDED
  to the dek: `{finding}. {figures sentence}. {optional
  st1 outlier sentence}.` An empty figures case degrades to
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
sentence uses, NOT demoVerdict's Holm correction. Probe the pooled
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
- alp (26.8): 55+ −5.0 → "under 55" · University +3.8 · inner metro
  +4.0. True but unused: Rest-of-Australia +4.7, rural −10.6.
- lnp (21.3): 55+ +4.2 · University +4.3 · inner metro +4.5 · own
  outright +8.1.
- grn (13.2): 18–34 +12.5 · women +1.7 · renting +5.1 · urban-or-
  provincial — rural is the only location significantly BELOW (−3.2*),
  so the claim rides the inversion (same pattern as ONP's
  "non-Victorian"); inner metro itself is only +1.9, NOT significant,
  so words like "city" unsupported alone. User's wording, after a
  same-day pass through "from cities": "urban or provincial" = every
  non-rural group (the line is FOUR traits now): "…18–34, women,
  renters, and urban or provincial". True but unused: other-language
  +3.6.

Do NOT build a generator for this: auto-generation was offered and the
user chose hand-written lines. If the pooled significances shift
enough that a listed trait goes non-significant, rewrite the line in
this map and nowhere else; the commit should cite the new pool.

## The dek's figures sentence can outrun the finding (flagged 2026-09-28, UNRESOLVED)

The dek's top/bottom figures sentence is emitted for EVERY grouping
tab — even one whose finding is "no significant difference" — and
quotes each extreme group's share via rdFraction (rd.jsx ~:157), which
snaps each value INDEPENDENTLY to the nearest candidate fraction from
a fixed list. When the two snaps diverge, the displayed gap far
exceeds the pool. Worked case, ONP gender tab: men 28.1±1.7 vs women
26.1±1.6 (all-voters 27.3; true gap 2.0pt; demoVerdict's pair test
z≈1.68, p≈0.09 → "One Nation's vote is much the same across men and
women") — yet the dek's second sentence read "About three in ten men
back One Nation, against one in four women", a 5-POINT display gap
flatly contradicting the finding above it. Two rdFraction mechanics to
know before trusting such a sentence:

1. each group snaps independently, so rounding errors stack in
   opposite directions (28.1 snapped UP to 3/10, 26.1 DOWN to 1/4);
2. the "about" hedge drops out when the snap error is under 0.012 —
   26.1 rendered "one in four" BARE (err 0.011), implying an exactness
   a ±1.6 pool doesn't have.

demoVerdict for reference (a11e1559 asset, demoVerdict): z =
1.96·(vₐ−v_b)/hypot(ciₐ,ci_b) per pair, Holm-corrected across all
N(N−1)/2 pairs. Two fixes were offered to the user — quote the SHARED
fraction for the no-difference case ("About one in four of both men
and women …"), or suppress the figures sentence there — decision
pending. If either ships, UPDATE this section and check the regression
probe's dek-shape assertions still hold.

## Regression probe

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
