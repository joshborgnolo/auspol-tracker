# The Infogram rung (spec) — Newspoll (built) + YouGov (proposed)

Both publishers run the same News Corp CMS, so one parser serves both. The Newspoll half is
**implemented** in `.build/infogram.mjs` (commit c3334a5); this document now also specs the
News24 / YouGov half, which extends the same module.

They differ only in id format, static-vs-live storage, and — the load-bearing difference —
whether embeds are pinned to the article.

## Why this exists

Article DOMs carry only placeholders, identical markup on both publishers:

    <div class="media embed-infogram infogram-embed" data-id="<id>" data-type="interactive">

No numbers, so a prose parser sees nothing and both skills concluded the graphics were
unreachable. They are served publicly by infogram.com / e.infogram.com / live-data.jifo.co:
**anonymous GET, no cookies, no login, no Chrome**. Third-party publicly-served content, not a
paywall bypass.

## Shared core — `.build/infogram.mjs`

Already generic and reusable across both publishers:

- `IG_EMBED(id)` → `https://e.infogram.com/<id>?src=embed`. Interpolates verbatim, so News24's
  `_/`-prefixed ids work unchanged.
- `infographicDataOf(html)` — brace-matched, string-aware extraction of `window.infographicData`.
  The payload is 50–70 KB; a lazy `};</script>` regex misses it.
- `liveChartsOf(data)` → `[{title, key}]`; `staticChartsOf(data)` → `[{header, rows}]`.
- Live charts then fetch `https://live-data.jifo.co/<key>`. The uncached sibling
  `/api/v1/atlas/getLiveData?id=<key>` returns **401** anonymously — use the CDN path, resolved
  at runtime from the embed page's inline `liveDataURL`.

**Selector caution:** do not substring-match `infogram-embed`. The first hit in either
publisher's page is `newscorpau.thirdPartyArticle.infogram = ["…/infogram-embed.js?ck=…"]`, the
loader script. Match the div and read `data-id`.

### Required change before News24 can use it

`staticChartsOf` gates each sheet on `sheet[0]?.[0]` being truthy. Three of News24's six charts
have an **empty top-left corner cell** — their header rows are `["", "Support"]`,
`["", "Anthony Albanese", "Don't know", "Angus Taylor"]` and
`["", "Labor vs Coalition", "Labor vs One Nation"]` — so they are silently dropped. Verified by
running the committed module over the six 2026-08-24 payloads:

    1HmxLVdMCZuLu6przWpP  Albanese-Taylor approvals     static=0   ← dropped
    KHPe2ut8KWwbhpNt9NFM  Preferred PM                  static=0   ← dropped
    jSJgw3l3groFHC28VREB  2PP                           static=0   ← dropped
    TBlBtAE3k0f4YBE6MIpF  voter issues                  static=1  header="Total"
    YM46DvOTftyx9pNzV67y  PV crosstab                   static=1  header="Party"
    pWKd54huH0REqno4nuue  horserace                     static=1  header="Party"

Those three carry the leader nets, both preferred-PM pairs and both 2PP pairs — i.e. every
YouGov row except the primaries. Gate on the sheet having ≥2 rows instead, and let an empty
`header` through; identify such charts by the payload's `title` / caption text (below) rather
than by the corner cell. Newspoll's charts all have non-empty corners, so the change is
inert for the built rung — but re-run `test-infogram.mjs` to confirm.

## Publisher profiles

|                     | The Australian / Newspoll                      | News24 / YouGov                    |
|---------------------|------------------------------------------------|------------------------------------|
| id format           | bare GUID                                      | `_/` + short id                    |
| embeds per article  | 2                                              | 6                                  |
| storage             | 1 live project (4 charts) + 1 static per-wave  | all 6 static (0 live blocks)       |
| **pinning**         | **project rolls forward** — old articles show today's wave | **fresh ids per wave** — pinned |
| backfill            | net-sat archive only                           | any past article                   |
| needs the article?  | no for rung A, yes for rung B                  | yes                                |

## The Australian / Newspoll — built

Implemented as rung A (live project via `IG_SLUG`, no article needed, four charts resolved by
`IG_LIVE_TITLES`) and rung B (per-wave static embeds from the article DOM). See
`.build/infogram.mjs` and the newspoll-extraction skill for the working detail.

**The governing trap:** The Australian republishes one project per wave, so old articles' charts
roll forward. Proof: `.matilda/chrome-aus.html` is the 2026-08-07 article — its prose says
Hanson's net was "minus-3" (46/49, the `August 3-7` column) — yet its embeds serve 2026-08-28
(47/48). Hence figures are dated from chart labels only, never from the story they rode in on.

## News24 / YouGov — proposed

Six static embeds, `_/` ids, all HTTP 200 anonymously. From the 2026-08-24 wave
(`one-nation-trails-labor-by-three-points…`):

| id                       | chart                                                    |
|--------------------------|----------------------------------------------------------|
| `_/pWKd54huH0REqno4nuue` | primary-vote horserace, 16 waves + 2025 election baseline |
| `_/YM46DvOTftyx9pNzV67y` | **the crosstab** — primaries by 46 demographic breaks     |
| `_/TBlBtAE3k0f4YBE6MIpF` | issue ownership, 12 policy issues × 5 parties             |
| `_/1HmxLVdMCZuLu6przWpP` | leader approvals — Albanese 35/59/6, Taylor 33/49/18      |
| `_/KHPe2ut8KWwbhpNt9NFM` | preferred PM — Alb 44 / DK 19 / Taylor 37, and Alb 52 / DK 11 / Hanson 37 |
| `_/jSJgw3l3groFHC28VREB` | 2PP — ALP v Coalition 53/47, ALP v One Nation 56/44        |

Every chart states fieldwork in a caption: `News24 Pulse / YouGov (August 18-24, 2026)`.

Ids are minted fresh per wave — this article's six and the 2026-07-28 article's five are
**completely disjoint**. News24 embeds are therefore pinned, and any past Pulse article still
serves its own wave's crosstab. Historical backfill works here, unlike Newspoll.

### Shape traps

- **Approvals is positional.** Both tables are headed only `| Support`, with no leader name.
  Order is Albanese then Taylor, per the chart *title* ("Albanese-Taylor approvals N24P …").
  Read the order off the title, and cross-check against the ppm chart's named columns before
  writing. If the title ever stops naming both leaders in order, fail rather than guess.
- **Preferred PM is safely keyed** — two tables distinguished by column name (`Angus Taylor`
  vs `Pauline Hanson`). Use the names, never the order.
- **2PP has blank cells by design** — one table, columns `Labor vs Coalition` and
  `Labor vs One Nation`; the Coalition row is blank in the ON column and vice versa. Blank is
  structural, not missing data.

## Field mapping

**Newspoll.** `Coalition→lnp, Labor→alp, Greens→grn, One Nation→onp, Other→ind`. `Other` maps
to **`ind`, never `oth`**. `N/A` in the tpp feed → `tpp_alp`/`tpp_lnp` **null**, not 0 and not
NaN; a future numeric value is a real 2PP resumption, not routine. Better-PM `Uncommitted`
(21%) is unmodelled — keep it out of the ppm Σ≤100.5 guard, which assumes one consistent set
(44+21+35 = 100 would otherwise read as a double-count).

**YouGov.** `Labor→alp, Coalition→lnp, One Nation→onp, The Greens→grn, Independent→ind,
Other + Community Strong→oth`. Verified against the 2026-08-24 row: Other 5 + Community
Strong 2 = `oth: 7`. **Community Strong is a new party column** with no home in the six-primary
shape except this bucket — revisit if it grows. `Don't know` columns are discarded, not
bucketed.

Both: three-way → `ppm.alb/opp/han`; head-to-head → `ppm.extra=[{alb,opp}]`; Albanese–Hanson
after-preferences → `ppmHeadToHead`; ALP-v-One-Nation 2PP → `altTpp.alpVsOnp_alp`; satisfaction
splits → `approval.detail.{alb,opp,han}{app,dis}`, net = app − dis.

## Dates

**Newspoll.** Live labels are **publication** dates; only rung B carries the fieldwork window.
Pair within `IG_DAY_WINDOW` AND require the `alb` value to agree. The primary feed carries no
year — anchor it, never the bare wall clock.

**YouGov.** Far cleaner: every chart's caption gives the range directly
(`August 18-24, 2026` → `dateStart` 2026-08-18, `date` 2026-08-24), and the body prose
corroborates — *"poll of 1510 voters was conducted online between August 18 and 24."*
Do **not** key on the horserace chart's labels: they run one day ahead of the tracker `date`
for every wave before June 2026, then align exactly from June 16 on.

## Authority ranking — the counterintuitive part

Not all Infogram charts are equal, and this is now proven on both publishers.

- **Per-wave crosstabs and static tables are authoritative.** They sum to 100 and matched the
  tracker field-for-field.
- **Time-series charts are hand-maintained summaries and contain errors.** The YouGov
  horserace's July 14 column reads `28|20|26|12|6|2` — sums to **94**; the tracker's 100 is
  right. Its Jan 8 column sums to **102**. On the Newspoll side, the net-sat archive's
  2026-02-08 Ley value is a **permanent** error (below).

Series charts are corroboration only — never authority, never a drop-in backfill oracle.

## Guards

Reuse each extractor's existing contract (exit 0/1/2, `*_STATUS` last line, atomic write,
nothing on no-change). Additions:

- **Σ100 on every primary set before use.** Not theoretical — see the two bad horserace columns.
- Newspoll: fewer than the four titled live charts resolve → guard.
- Cross-source disagreement with the prose rung > 0.5 pp → exit 2.
- Freshness on live feeds: `refreshed` and the label date ≥ the latest recorded wave, else the
  CDN served a stale object — skip, do not write.
- Reconciliation against existing rows stays **READ-ONLY** (`NP_NOTE` on divergence), as built.
  Adjudicate by hand; never let a chart silently overwrite an ingested row.

## Not available from embeds

- **`sample`** — neither publisher puts it in a chart. YouGov's sits in one clean body sentence
  (above); Newspoll's likewise needs prose.
- **`published`** — available, but from JSON-LD `datePublished` (News24: `2026-08-25T11:00Z`).

## New data not currently modelled

YouGov crosstabs (46 demographic breaks per wave), YouGov issue ownership (12 issues × 5
parties), Newspoll's `Uncommitted` percentages. All free with this rung if the schema wants them.

## Validation

- **Newspoll 2026-08-28** — every field matches: primaries 29/19/13/30/9, `detail.han {47,48}`,
  ppm 46/23/31, `ppmHeadToHead` 56/44, approval alb −21 / Taylor −17.
- **YouGov 2026-08-24** — every field matches: primaries 29/21/26/12/5/7, TPP 53/47,
  approval −24 / −16 off 35/59 and 33/49, ppm 44/37, `ppmHeadToHead` 52/37, `altTpp` 56.
- **Newspoll net-sat recon** — adjudicated in commit 0bcae06, now **15/16 exact**:
  Infogram right on 2025-10-02 (Ley −21 → −20, tracker transcription) and 2026-06-04 (Taylor
  gap filled −10); **tracker right on 2026-02-08** (kept −39 — the −35 is a The Nightly misprint
  the mutable chart inherited, and a permanent chart error that keeps surfacing as `NP_NOTE`).
- **YouGov horserace vs 22 poll rows** — 5 exact, 1 divergent (2026-07-14, chart sums to 94 →
  chart wrong), 10 unmatched purely from the +1-day label offset.

The 2026-02-08 outcome is the reason reconciliation stays read-only: the publisher's own
graphics were wrong and the tracker was right.

## Open questions

1. Is Newspoll's rung B GUID reused each wave or minted fresh? It rolled forward once, which
   suggests reuse. Refetch `8b461452-4d45-46fc-8d8f-d1c761a4932e` after the next release: if it
   serves the new wave, rung B becomes article-free and Chrome drops out of Newspoll entirely.
2. YouGov alignment: the tracker has a 2026-03-19 wave the horserace omits, and the horserace
   has a Jan 8 point the tracker dates 2026-01-27. Adjudicate before trusting either.

## Durability

Undocumented endpoints. `e.infogram.com/<id>?src=embed` + `window.infographicData` is the
durable surface; `live-data.jifo.co` is a CDN path read out of `embed_flex_viewer-*.js` and is
likelier to move. Fail loudly rather than silently when it 404s.

## Discovery is unaffected

Walled pages give up nothing: The Australian serves HTTP 200 "No Cookies" with
`thirdPartyArticle.infogram = []`; News24 serves HTTP 404 "Nocookies". Getting `data-id`s still
needs a rendered read. This rung improves extraction and enrichment, not "is there a new wave" —
so it does not bear on the YouGov agent's DEGRADED / cadence-occlusion question.
