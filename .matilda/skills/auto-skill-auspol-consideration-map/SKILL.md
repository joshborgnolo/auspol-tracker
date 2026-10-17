---
name: auspol-consideration-map
description: auspol-tracker — the per-poll `consideration` map end-to-end ("which parties would you consider voting for", display-only, aggregates never see it), the worked 2026-10-15 Blueprint Institute filing (YouGov (MRP), ALL-NULL primaries because the wave asked no voting-intention question; `ind` became the seventh cons key), the FIVE homes a new cons key must land in, the IND-does-NOT-fold-into-oth rule (gen-data's primaryOf ind+oth lump applies to INTENTION only), the SECOND rung filing RedBridge/Accent's April 2026 0-10 propensity battery as cons tiers (canonical seriously-consider ≥7, `considerationLoose` ≥4, `considerationNot` ≤3 — added `4a207dd` — `considerationNever` 0, REBASED all-voters; mandatory `consBasis`; the row displays ONE range via the RdApConsCyc cycle button), the THIRD rung (commit 472d31e) filing Essential's Feb/Jun 2026 definitely/open-to/never banding under the SAME tier schema (verbatim, no rebase) with rd-allpolls.jsx's per-pollster RD_AP_CONS_TIER label map as its single display-string home, the 2026-10-17 user call that made the LOOSE "would consider" range the DEFAULT everywhere (rung 3: one-line CONSIDERATION ledger via rdApConsDef, cycler opens loose-first, story/sort read the default range; label column widened to 110px when CONSIDERATION's 98px natural wrapped off its 96px cell), and the count-keyed allpolls-cons probe that must move N→N+1 on every new consideration wave AND identify banded rows by fieldwork-date NEEDLE — the two Essential rows cycle byte-identical labels, so label disambiguation can never tell them apart.
source: auto-skill
extracted_at: '2026-10-15T02:20:42.733Z'
---

# Voting-consideration field: keys, homes, and filing a cons-only wave

The All-polls primary facet's consM flip (`?f=p&k=1`, "Voting consideration ⇄")
scopes the table to waves whose row carries a `consideration` map and swaps
every figure to consideration shares. Worked 2026-10-15 filing the YouGov
(MRP) / Blueprint Institute wave (commit `2f583ea`); earlier rung 4ee8c98
shipped the feature and had deliberately excluded that wave ("stays out — no
poll row of its own") until the user asked for it.

## Data conventions

- polls.json row field `consideration`, keys
  `alp`/`lnp`/`grn`/`onp`/`oth`/`none` **plus `ind`** (Blueprint only — the
  one wave that offered an Independent option).
- Multi-select: shares sum past 100, no base discipline, absent-not-zero.
- **`consBasis` is mandatory alongside `consideration`** (validate §2b1ca,
  ≤40 chars): the short basis label printed beside the row's figures —
  under them on the desktop table, at the phone card head's RIGHT EDGE
  (the `.rd-ap-dpair` slot, `968ef59` 2026-10-15) — and since `968ef59`
  always in its full "Would …" form ("Would consider", "Would seriously
  consider", "Would ever support"; user-dictated); the tier labels
  follow the same convention (`eadb8f2`) and, since `4a207dd` (same
  day), every displayed RedBridge scale bracket reads an INEQUALITY —
  "Would seriously consider (≥7/10)", "Would consider (≥4/10)",
  "Would not consider (≤3/10)" (renamed from "not vote" by `a11f4e4`,
  user call) — except never's "(0/10)": "Would never
  vote (0/10)". Essential's bare "Would never vote" carries no scale.
- **Tier maps `considerationLoose` / `considerationNot` /
  `considerationNever`** (`considerationNot` is RedBridge-only, added
  `4a207dd`) are gated to RedBridge/Accent AND Essential (validate
  §2b1cb — widened to `["RedBridge/Accent", "Essential"]` in 472d31e;
  ranges 0–100, loose ≥ canonical per SHARED key — the ordering check
  stays loose-only; `considerationNot` has no canonical-side
  inequality since it measures the opposite end — and rejects orphan
  tier fields on a row without `consideration`). RedBridge: loose =
  rated ≥4 of 10, not (would-not-consider end) = rated ≤3 of 10, never =
  0 of 10, REBASED to all voters — ASYMMETRICALLY: the consider-end
  figures count the party's own voters (primary + (100 − primary) ×
  share-among-asked), the not/never-end figures do NOT
  ((100 − primary) × share-among-asked; `dc60c46` fixed the not tier
  after it first shipped with the consider formula — validate now pins
  loose+not ≤ 100 ("cons-tier-sum") and never ≤ not ("cons-tier-nest")).
  Not's shares among ratings 0–3: {alp 32, lnp 33, grn 49, onp 42}.
  Essential Feb+Jun 2026: canonical
  = the "would definitely vote" band,
  loose = definitely+open (the values Essential always printed — they
  were this field's original canonical "consider" shares), never =
  "would never vote", all three printed verbatim because Essential
  already bands the whole sample (NO rebase). gen-data's archive+latest
  emitters both pass `cons`/`consBasis`/`consLoose`/`consNot`/`consNever`
  through
  unchanged — a third tiered house needs ZERO gen-data edits; check the
  built `9f09dca2-*` bundle carries `consLoose`/`consNot`/`consNever`
  before
  assuming otherwise (this session's early probe "FAIL" that looked
  like a missing `consNever` was a probe-state bug, not a data bug).
- Figures are VERBATIM-from-source display data, never derived (ONE
  sanctioned exception: the RedBridge/Accent April 2026 tiers — see the
  "0–10 tiers" section below). Read them
  off the primary PDF, not Wikipedia — the "Voting-consideration" table's
  column order (ALP/L-NP/GRN/ONP/IND/Others) differs from what a quick
  paste suggests, and an early read of the Blueprint row had ON/IND/OTH
  scrambled (21/…/16 vs the true 12/14/4).
- **IND ≠ OTH here.** gen-data's `primaryOf` (~:2345) folds row-level
  `ind+oth` into `oth` — but only for INTENTION figures. The cons map is
  not run through `primaryOf`; Blueprint printed Independent 14 and
  Another Party 4 as separate options, so the row keeps
  `"ind": 14, "oth": 4` and 18 is never invented.
- A wave with **no voting-intention question** files ALL-NULL primaries
  (`alp…oth`, `tpp_*` all null) — the direction-only-row precedent in
  `auspol-direction-only-rows`. The Blueprint poll asked consideration
  only (Poll Bludger thread: "not concerned with voting intention").
- Pollster vs client: `pollster: "YouGov (MRP)", client: "Blueprint
  Institute"` — matches check-coverage's existing MRP machinery
  (`"yougov": ["YouGov", "YouGov (MRP)"]`, MRP waves match the (MRP)
  variant only), so the Wikipedia Blueprint row immediately gaps green
  with no watchdog edits.
- `date`/`dateStart` are FIELDWORK (10–29 Jul 2025), `published` the
  release stamp ("2025-09-02T03:13", Poll Bludger thread timestamp) — a
  two-month fieldwork→publication lag is fine.

## The five homes (all moved together for a new key)

1. **validate.mjs §2b1ca** — pollster whitelist + cons-key vocabulary
   gate.
2. **rd-allpolls.jsx `ORDER` const** (~:1966, the `if (p.cons)` block) —
   the expanded-poll poll ledger's consideration line order; NEW_KEY must
   sit in it or the ledger line silently drops that figure. Since
   2026-10-17 the ledger prints ONE "Consideration" line reading the
   DEFAULT range (the `rdApConsDef(p).m` map, see the default-range
   section below) — not a per-tier block of lines.
3. **rd-allpolls.jsx `RD_AP_PRIM_META`** (~:210) — label/ink/dot per key;
   a META-only entry (`ind: { lab: "IND", ink: "var(--ink-2)", dot:
   "var(--oth)" }`) surfaces ONLY on rows literally carrying the key,
   because the ladders/`rdApPrimList` walk gen-data's five-key
   `primaryOrder` ids. Do NOT add the key to `primaryOrder` — the whole
   primary ladder stays five-lane; cons is direct key lookup.
4. **README.md "Voting consideration" bullet** — key list, the sources
   (YouGov News24/serious, Essential's consideration module — its
   Feb/Jun 2026 waves tiered since 472d31e: canonical "definitely vote",
   loose the definitely+open sum it used to file as the canonical
   "consider" share, never the "would never vote" band, NO rebase —
   vs the RedBridge rebased-to-all-voters tiers), YouGov (MRP) client
   waves), the absent-not-zero rule, and a sentence when a wave is
   cons-only ("The Blueprint wave published consideration only — no
   voting intention — so its row's primary fields are null.").
5. **.matilda/probe/allpolls-cons.mjs** — count-keyed assertions that must
   move on EVERY new consideration wave: `nCons`, `cons.nRows`,
   `landed.nRows`, phone `on.nCards`, the `"\bN of \d+ polls"` tally
   regex (desktop + phone), plus the header comment and message strings.
   The RedBridge CYCS entry carries one object PER CYCLE PRESS from the
   default range (since 2026-10-17: loose ≥4 → canon ≥7 → not ≤3 → never
   0 — press n+1 wraps back to the default), with the phone
   section pressing through each in turn (`on`, `on2`, `on2b`, `on3`) —
   a new tier adds an entry AND a press. The probe also pins the ledger
   contract: open the Essential 24–29 Jun row and read `.rd-ap-open
   .rd-ldg` — exactly ONE `.rd-ldg-line` labelled Consideration carrying
   the loose figures {50,50,40,52,56} and the summed-bands note, label on
   one rendered line.
   Probe dir is gitignored; committed pinning probes need `git add -f`
   (see auspol-probe-drift-repair).
6. **Tiered-wave display strings (rd-allpolls.jsx
   `RD_AP_CONS_TIER`, ~:2508, added 472d31e)** — the SINGLE home for a
   banded house's cycler tab labels and the loose tier's ledger note:
   `{pollster: {loose: {tab,note}, not: {tab}, never: {tab}}}` with
   fallback to the RedBridge/Accent entry via the `rdApConsTier(p,
   tier)` helper, consumed by `rdApConsDef` and the tiers builder
   (~:3345). The `led` long-form label keys were REMOVED 2026-10-17 when
   the tier's separate ledger lines went away (the ledger reads only
   `{loose…note}` for its one line; the not/never tiers surface nowhere
   outside the cycler). A new banded house edits ONLY this map — never inline
   strings at the consumers.

## The default "would consider" range (user call 2026-10-17)

One range is the wave's DEFAULT and everything outside the cycler reads
it: the loose tier when the wave has one (`consLoose`), else its only
`cons` figures. The helper is `rdApConsDef(p)` (rd-allpolls.jsx, defined
just after `rdApConsTier`, ~:2525), returning `{m: <figure map>, lab:
<display label>, note: <ledger note>}`:

```js
p.consLoose ? { m: p.consLoose, lab: rdApConsTier(p,"loose").tab, note: rdApConsTier(p,"loose").note }
            : { m: p.cons, lab: p.consBasis || "Would consider", note: p.consBasis || "parties the voter would consider" }
```

Its four consumers, all in the same pass:
- **rdLgLines** (~:1966) — ONE "Consideration" ledger line (the tiered
  ledger lines for canonical/loose/not/never are GONE; the full
  breakdown lives only in the cycler).
- **the tiers builder** (~:3345) — the row's tier order is loose →
  canonical → not → never, so the cycler OPENS on the default and its
  first press lands on the second range (RedBridge ≥7; Essential
  "definitely vote"). CYCS in the probe rides this order.
- **`rdApConsStory`** (~:2388) — the facet story's figures all read
  `rdApConsDef(p).m` and its basis reads `rdApConsDef(p).lab`
  (before this change the story read the canonical `cons` map).
- **d1a1d215 :5877-5883** — the consM sort keys read
  `(p.consLoose || p.cons)` inside the `p.cons &&` guard, so at-a-glance
  order matches the printed figures (the SAME-INSTANCE map object rule
  applies: whichever map the row shows is the one the sort key must
  read).

CSS side effect: the ledger's "CONSIDERATION" label measures 98.08px
natural at every desktop rung and WRAPPED its last letter under the
long-standing 96px grid column — `.rd-ldg-line`'s label column is now
110px (rd.css :3664, comment explains). Any future change that drops the
column back down re-wraps ALL-CAPS labels in the 96–110px band.

## Verification & commit

1. `node .build/newtracker/validate.mjs` (build runs it too) — the new key
   must not trip §2b1ca.
2. `node .build/newtracker/build.mjs`; grep the data bundle
   (`.build/newtracker/assets/9f09dca2-*.js`, see auspol-bundle-data-probe)
   for the exact `cons":{` payload — 8 rows, Blueprint figures verbatim.
3. `node .matilda/probe/allpolls-cons.mjs` all green at the new count;
   `npm test` green.
4. Commit owned paths only (shared tree): polls.json, README.md,
   validate.mjs, gen-data.mjs (comment), rd-allpolls.jsx, probe, and the
   regenerated files (`index.html`, the three tab pages, the data asset,
   `assets/auspol-now.json`…). Watch for UNRELATED stale pins going red in
   `npm test` while you work — test-confidence's live-tail pin broke during
   this session (see auspol-mood-panel's "live-tail pins" note) and its
   fix rides in the same commit by necessity.

## Tier filing: the two worked rungs and their invariants

**Rung 1 — RedBridge/Accent April 2026 (commit `930932a`; fourth tier +
≥/≤ notation `4a207dd` same day)**: the 0–10
propensity battery, asked only of each party's NON-voters, so every
published share must be rebased before it can sit over all voters (the
field's ONE sanctioned derivation) — ASYMMETRICALLY: the CONSIDER end
counts the party's own voters back in
(`primary + (100 − primary) × share_among_asked`), the NOT/NEVER end
does not (`(100 − primary) × share_among_asked` only — current voters
are certainly not would-not-considers). Canonical = ≥7 of
10 (seriously-consider end), `considerationLoose` = ≥4,
`considerationNot` = ≤3 (the would-not-consider end {32,33,49,42} from
the report's tables 40–43 ratings 0–3 — `dc60c46`: the tier's first
pass in `4a207dd` applied the CONSIDER formula here and shipped
{63,55,62,69}, blowing loose+not to 107–125; validate's cons-tier-sum
guard is the tripwire), `considerationNever` = 0. The row
displays ONE tier at a time via the RdApConsCyc cycle
button (since 2026-10-17 opening on the loose ≥4 range: loose →
canonical → not → never); `nCyc` (cycles per row) = 4.
Babel does NOT escape ≥/≤ in the bundle — literal-character greps of
the built pages are valid for these labels.

**Rung 2 — Essential Feb+Jun 2026 (commit `472d31e`)**: Essential's
consideration module bands EVERY voter definitely/open-to/never (band
vocab verified against `data/essential-report.csv`'s
`political_party_consideration` block: "I would definitely vote for
them" / "I would be open to vote for them" / "I would never vote for
them"). So NO rebase exists — the three tier maps are printed verbatim;
the canonical SHIFTS to the firm band and the old canonical shares
become loose: `consideration` = "definitely" ({onp:25} Feb, full June),
`considerationLoose` = definitely+open (the long-filed "consider"
figures, e.g. onp 58 Feb / 50,50,40,52,56 June), `considerationNever`
= "would never vote"; `consBasis` flips "consider" → "definitely vote"
(since `968ef59` displayed as "Would definitely vote"). Since 2026-10-17
the LOOSE band is the display default here (user call), so the filed
canonical "definitely vote" figures surface only one press into the
cycler — grep checks on the built pages must expect the loose figures,
not the canonical ones.
Source: `https://essentialreport.com.au/questions/political-party-consideration`
+ the Feb wave's report page. Invariant before filing: loose ≥ canonical
on EVERY shared key (Feb is a single-key onp row, June full).

Both rungs share the renderer: per-pollster strings live ONLY in
`RD_AP_CONS_TIER` (home 6 above). Essential's tier prose uses curly
quotes inside note strings (‘definitely’…) — the babel build escapes
them to `\u2018…` in the bundle (auspol-built-html-verification), so
assert with ASCII when grepping built output.
`"definitely or open"` appears exactly ONCE in built `index.html` (the
loose tab label — the tier ledger lines that made the count two were
removed 2026-10-17).

### Probe lesson: rows with identical cyclers are needle-identified

The single hardest probe bug of rung 2: Essential's June and Feb rows
cycle through the SAME labels at every position ("definitely vote" ⇆
"would consider (definitely or open)" ⇆ "would never vote" — since
`968ef59` the first two DISPLAY capitalised as "Would definitely vote"
/ "Would consider (definitely or open)", since `eadb8f2` the third
displays as "Would never vote", and since 2026-10-17 the cycle OPENS on
the loose band), so a label
+ aria-next selector can NEVER tell them apart — pressing a "definitely
vote" button always landed on the June row (DOM order), desyncing every
subsequent assert (11 probe FAILs, all probe-identification, page
correct). A wrapped row even mimicked "missing consNever" ([—,25,—,—,—]
was the SINGLE-key Feb row back at canonical after three presses, not a
dropped tier — always confirm against the `9f09dca2-*` bundle before
believing a probe's "field missing" read).
Fix pattern: find rows by FIELDWORK-DATE NEEDLE — `NEEDLES = {rb:
"24-30 Apr", essJun: "24-29 Jun", essFeb: "18-23 Feb"}` — matched
against `norm(row.textContent)` where `norm()` lowers en-dashes to
hyphens (the bundle emits "24–29 Jun" en-dash). Table rows carry NO
data-pollster attr; the date lives in `.rd-ap-when b` (desktop) and the
card's `.rd-ap-c2 .rd-ap-sub` meta ("Essential, 24–29 Jun, N").
Row identification that is label-shaped is identification that breaks
the day a second wave of the same house files the same tier schema.

## Census: who has ASKED consideration (audited 2026-10-15)

Answers "are you sure no other pollster asked consideration at another
time?" and (in response to "check RedBridge") verified against primary
sources, not just the captured rows. **In polls.json** — exactly nine
rows: YouGov (MRP) 2025-07-29 (Blueprint Institute) + 2025-11-17
(Climate Council), Essential 2026-02-23 (onp) + 2026-06-29 (full),
RedBridge/Accent 2026-04-30 (the tiered 0–10 wave below), and
YouGov/News24 2026-02-24 (onp) + 2026-06-02/06-16/06-30 (full).
**Elsewhere in the repo** — nothing uncaptured: a `consideration|
consider voting` grep over ALL of `data/` matches only corroboration
(`data/essential-report.csv`'s `political_party_consideration` block is
all dated 2026-06-30 — same wave as the captured June-29 row; the
News24 June entries live in `data/news24-one-offs.json`, see
auspol-news24-question-audit). **NOT captured** — known and unverifiable
gaps:

- **RedBridge/Accent asked it ONCE, structurally differently**: the April
  2026 report (fieldwork 24–30 Apr 2026, the `2026-04-30` polls.json row)
  carried a 0–10 "Likelihood of voting for each party at a future election"
  battery for Lib/ALP/GRN/ON/Nat — each skipped for current voters of that
  party ("0 means you would never vote for this party…"; net = share 6–10
  minus 0–4, computed among NON-voters of the party). All-voter nets:
  Lib −25, ALP −25, Nat −30, GRN −42, ON −42 ("never" (0): ON 41% highest).
  Full crosstabs live cached in `.build/redbridge-src/
  afr,-redbridge-group-and-accent-research-april-2026-federal-poll.txt`
  (question ~:2620, Figures 42–46 / Tables 40–44). It is the ONLY
  consideration-family question in the ten cached monthly Accent reports
  (Nov 2025 → Sep 2026); the same report also ran an ON "most hesitant"
  battery ending in "I would never vote for One Nation". It sat out of
  the field while the cons map was strictly binary share-naming-a-party —
  then became a row the same day via the tier derivation in the section
  below (commit `930932a`).
- **Unverifiable from the repo**: Accent reports before Nov 2025 and the
  standalone RedBridge Group briefs (e.g. the `2026-02-12` "One Nation
  voters and gas exports" PDF, pollster `Redbridge`) are not cached in
  `.build/redbridge-src` — fetch the primary if a census needs them.
- **Outside the ingest entirely**: Essential's Guardian/Essential party
  consideration battery ran episodically before the `consideration`
  field existed (~2019 on; only the two 2026 waves are captured), and
  Newspoll has asked One-Nation-consideration questions episodically
  (2017/2019/2024–25) — none captured anywhere in the repo.
