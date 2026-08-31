# Newspoll extraction: the Infogram rung (spec)

Drafted 2026-08-31. Adds a **structured, publisher-of-record** source to
`.build/extract-newspoll.mjs`, alongside the existing coverage-prose rungs.
Not a replacement — a rank-0 corroborator that also fills fields prose cannot reach.

## Why this exists

The Australian's Newspoll graphics are Infogram embeds. The article DOM carries only
placeholders — `<div class="media embed-infogram infogram-embed" data-id="<uuid>">` — so a
prose parser sees nothing and the skill concluded the graphics were unreachable. They are
served publicly by infogram.com / e.infogram.com / live-data.jifo.co: **anonymous GET, no
cookies, no login, no Chrome**. This is third-party publicly-served content, not a paywall
bypass.

## Rung A — the live project (needs NO article, ever)

Stable slug, verified addressable without any GUID:

    https://infogram.com/federal-newspoll-regular-1h7v4pdj7oj184k

Parse `window.infographicData` (brace-match from the first `{` after the marker; the payload
is ~59 KB of JSON, and a lazy `};</script>` regex misses it). Walk to every
`props.chartData.custom.live` and read `{ title, key }`. Four charts resolve:

| `live.title`                        | key                                    |
|-------------------------------------|----------------------------------------|
| Newspoll Federal Primary Vote       | `16c83c4c-fafd-44c5-96b5-84d13b8e8a4e` |
| Newspoll Federal Two-party preferred| `4e957028-4477-442a-8600-d91a36a7b2ff` |
| Newspoll Federal Better PM          | `465e45cc-8e13-4c5e-baf5-e4adaaac822a` |
| Newspoll Federal PM Net Satisfaction| `d349d154-3da2-41e7-807f-899a871a526b` |

**Resolve keys by `live.title` on every run; do not hardcode them.** Hardcode only the slug.
A rotated key then self-heals; a renamed chart trips the "fewer than 4 titles resolved" guard
instead of silently reading a stale key.

Then fetch each `https://live-data.jifo.co/<key>` →
`{ data: [[ [cell,...], ... ]], sheetNames, refreshed }`. Cells are plain strings with a `%`
suffix on the value charts. Observed 2026-08-31:

    primary  [["Primary","August 30"],["Coalition","19%"],["Labor","29%"],
              ["Greens","13%"],["Other","9%"],["One Nation","30%"]]
    tpp      [["DATE","March 1"],["ALP","N/A"],["Coalition","N/A"]]
    betterpm [["Name","Anthony Albanese","Uncommitted","Angus Taylor"],["%","44%","21%","35%"]]
    netsat   [["Date","Anthony Albanese","Peter Dutton","Sussan Ley","Angus Taylor"],
              ["July 31, 2022","35","-4","",""], … 58 rows … ["Aug 30, 2026","-21","","","-17"]]

The uncached sibling `/api/v1/atlas/getLiveData?id=<key>` returns 401 anonymously — use the
`live-data.jifo.co` CDN path only.

## Rung B — the per-wave static embed (needs the article DOM once)

From the rendered article, select `div.infogram-embed[data-id]` and fetch each
`https://e.infogram.com/<data-id>?src=embed`. Static charts carry their values **inline** at
`props.chartData.data` as `{value: "47%"}` cells. The 2026-08-28 release's second embed
(`8b461452-4d45-46fc-8d8f-d1c761a4932e`, project "A TAD-2383 Newspoll Day 2") yielded:

- **Hanson's Performance** — a rolling four-wave table with explicit fieldwork ranges:
  columns `August 24-28 | August 3-7 | July 13-16 | June 22-25`;
  Satisfied `47/46/47/46`, Dissatisfied `48/49/47/49`, Uncommitted `5/5/6/5`.
- **Ranked 1st PM** (three-way): Albanese 46, Taylor 23, Hanson 31.
- **Preferred PM distributed between top two leaders**: Albanese 56, Hanson 44.

Discovery note: the walled page is useless for this — it ships
`newscorpau.thirdPartyArticle.infogram = []`, empty. In the rendered DOM that array holds only
the *loader script* URL, never the ids, so **the `data-id` attribute is the only selector**.
Rung B therefore still needs `NEWSIE_CHROME=1` (or an archive snapshot), exactly as today.

## The trap that governs the whole design

**Embeds are not pinned to the article.** The Australian republishes the same Infogram project
each wave, so an old article's charts roll forward. Proof: `.matilda/chrome-aus.html` is the
2026-08-07 article — its prose says Hanson's net was "minus-3" (46/49, the `August 3-7` column)
— yet its embeds today serve the 2026-08-28 wave (47/48).

Consequences, both load-bearing:

1. **Never attach embed figures to the article you found them in.** Date them from the chart's
   own labels. Scraping an old article would stamp today's numbers on an old story — a worse
   failure than the phantom 37/63, because the result looks plausible.
2. **Historical waves cannot be backfilled** from Rung A's primary/betterpm/tpp feeds; they are
   latest-only. `netsat` is the exception — a genuine 58-point archive back to July 2022.
   Rung B's four-wave window is a second, shorter archive.

## Field mapping

- `Coalition→lnp, Labor→alp, Greens→grn, One Nation→onp, Other→ind`. **`Other` maps to `ind`,
  never `oth`** — the existing 16/16 Newspoll convention.
- `N/A` in the tpp feed → `tpp_alp`/`tpp_lnp` **null**, not 0 and not NaN. A future numeric
  value is a real 2PP resumption and should be treated as newsworthy, not routine.
- Better PM `Uncommitted` (21%) is not currently modelled. Either carry it in
  `ppm.extra[0].unc` or drop it — but do **not** feed it to the ppm Σ≤100.5 guard, which
  assumes one consistent set (44+21+35 = 100 would otherwise read as a double-count).
- Rung B three-way → `ppm.alb/opp/han`; head-to-head → `ppm.extra=[{alb,opp}]`; the
  Albanese–Hanson after-preferences 56/44 → top-level `ppmHeadToHead`. That section is inserted
  **manually** today; this rung can automate it, sorted-insert by date.
- Hanson satisfaction → `approval.detail.han {app,dis}`; `hanNet = app - dis`.

## Dates — the subtle part

Rung A's labels are **publication** dates ("August 30", "Aug 30, 2026"); the tracker keys on
**fieldwork end** (2026-08-28). Only Rung B carries the true window ("August 24-28" →
`dateStart` 2026-08-24, `date` 2026-08-28). Reconciling the netsat series against the 16
existing approval rows, labels lag the tracker date by 0–3 days inconsistently.

So: **pair by nearest label within +0..+5 days AND require the `alb` value to agree** before
accepting a match. Naive equality mispairs. Rung A's primary feed carries no year at all
("August 30") — take the year from the release window, never from the current clock alone.

## Guards

Reuse the existing contract (exit 0/1/2, `NP_STATUS` last line, atomic write, nothing on
no-change). Additions:

- Fewer than 4 live titles resolve → exit 2.
- Cross-source disagreement with the prose rung > 0.5 pp → exit 2 (existing merge guard;
  this rung makes it meaningful rather than theoretical).
- Freshness: `refreshed` and the label date must both be ≥ the latest recorded wave, else the
  CDN served a stale object — skip, do not write.
- Existing Σ, ppm-tie, net-bounds, field-span, lag and sample guards unchanged.

## Validation already done — use as the regression oracle

Against the current 2026-08-28 rows, every embed figure matches: primaries 29/19/13/30/9,
`detail.han {47,48}`, ppm 46/23/31, `ppmHeadToHead` 56/44, approval alb −21 / Taylor −17.

The 58-point netsat series reconciles **13/16 exact** against existing approval rows, with
three divergences to adjudicate **before** wiring this in as an authority:

| date       | tracker            | infogram          | note                         |
|------------|--------------------|-------------------|------------------------------|
| 2025-10-02 | alb −1, opp −21    | alb −1, Ley −20   | 1 pp                         |
| 2026-02-08 | alb −10, opp −39   | alb −10, Ley −35  | 4 pp — Ley's last wave       |
| 2026-06-04 | alb −24, opp null  | alb −24, Taylor −10 | tracker gap the feed fills |

`alb` agrees in all three, so the pairing is sound and the `opp` figures genuinely differ.
A chart series can carry its own typos, so this is not automatically a tracker correction —
adjudicate against the release before overwriting.

## Open question

Is the Rung B GUID reused each wave or minted fresh? It rolled forward once, which suggests
reuse. Refetch `8b461452-4d45-46fc-8d8f-d1c761a4932e` after the next release: if it serves the
new wave, Rung B becomes article-free too and Chrome drops out of the pipeline entirely.

## Durability

Undocumented endpoints. `e.infogram.com/<id>?src=embed` + `window.infographicData` is the more
durable surface; `live-data.jifo.co` is a CDN path read out of
`embed_flex_viewer-*.js` (`liveDataURL`) and is likelier to move. Resolve it from the embed
page's inline config at runtime rather than hardcoding, and fail loudly rather than silently
when it 404s.
