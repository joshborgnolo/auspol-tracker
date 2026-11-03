# Group poll error at the 2025 election (2026-11-03)

**Question.** How wrong were the polls' group breakdowns (state, region, gender, age, education, income, work,
housing) at the 2025 federal election? What follows for the site's "since the election" claims and for /model/?

**Data.** Poll Bludger's BludgerTrack feed for the 2022–25 term (`fed2025/bludgertrack/xml/current.xml`, still
live) holds every poll's published crosstabs, not just its toplines. Newspoll, YouGov, RedBridge, Resolve,
Essential and DemosAU all printed group breakdowns in the five weeks before the election. The repo's own store
(`data/demographics.json`) starts after the election, so until now we held no pre-election group reading from any
pollster. The table is copied into `bludgertrack-2022-25.json`. The 2016–19 and 2019–22 feeds have no demographic
cuts (see `.matilda/skills/auto-skill-auspol-bludgertrack-archive`), so 2025 is the only election this can test.

**Verdict.**

- **Against the count, polls and the AES do about equally well.** That covers states and the AEC's region classes.
  Both miss by somewhat more than their sampling error.
- **Against the AES, the houses agree with each other but not with the AES.** On several demographic gaps the
  houses differ from the AES by more than both margins. They agree with each other, and the differences held
  across the whole 2022–25 term, so this is the two instruments measuring differently, not a campaign event.
- **The site's election test.** It measures "since the election" from the AES. Some of what it reports as change
  is this instrument difference. Re-asked against the polls' own election-time readings:
  - **Holds:** the Coalition among graduates (smaller: +4.0 rather than +7.1) and others among men.
  - **No change:** the Greens' gender-gap narrowing, the Greens among voters with Year 12 or less, and others among
    outright owners.
  - **Missed:** nine same-instrument changes the AES test can't see, mainly a large flattening of the Coalition's
    and One Nation's age gradients.
- **The seat model.** Nothing moves by a seat:
  - Coalition education: the real shift is about +0.34 logit, not the +0.60 measured against the AES.
  - Rebasing the state deviations on each house's own election-time state cells moves seats by at most 0.1.

## 1. Against the count: states and regions (`group-error.mjs` → `out/group-error.txt` §1–2)

These are the only groups with a true answer, so they test the AES as well as the polls. Each instrument's group gap
(state − nation, class − nation) is compared with the count's. Points, final five weeks, houses pooled.

| Mean z² (≈1 = errors the size of sampling) | Labor | Coalition | Greens | One Nation | Others |
|---|---|---|---|---|---|
| Polls v count, states (5 houses) | 0.85 | 1.73 | 1.82 | 3.34 | 6.16 |
| Polls v count, region classes (RedBridge) | 2.86 | 2.09 | 2.20 | – | – |
| AES v count, states (all parties) | 1.58 | | | | |
| AES v count, region classes (all parties) | 1.63 | | | | |

- **Pooled, the states are close.** Across houses the states sit within about 1.5 points of the count. The misses
  past that are Queensland Coalition +1.5, SA One Nation +3.9 and "others" in Victoria, NSW and WA.
- **Single houses lean more.** Some leans are persistent (`out/house-baselines.txt`):
  - YouGov: NSW Greens +3.2, SA One Nation +5.2, SA Greens −4.9.
  - Newspoll: SA others +3.7.
- **RedBridge's rural respondents weren't rural enough.** Labor's rural gap was −4.1 against the count's −10.2, and
  the Coalition's 0.0 against +5.9 (z ±2.5). Inner-metro Greens were +1.0 against +4.3.
- **The AES missed too, on different cells.** It got rural Labor and Coalition right but put rural Greens 4.9 points
  too high and Victorian One Nation 3.1 too low. Its Kish margins understate its error by about a quarter
  (z² ≈ 1.6).

## 2. Against the AES: demographic groups (`out/group-error.txt` §3–5)

The AES 2025 is cut on the polls' own bands (`aes-cuts.py` → `aes-cuts.json`): age 18-34/35-49/50-64/65+, household
income, work status with "Other", and AEC region from the respondent's division. Comparisons are gap to gap. The
houses mostly agree with each other (Q/df ≈ 1), and the pooled polls differ from the AES here:

| Gap from all voters, points | Polls (pooled) | AES | z |
|---|---|---|---|
| Labor, women | −0.4 | +2.7 | −2.1 |
| Greens, women | +2.1 | +5.0 | −2.8 |
| Coalition, 18–34 | −12.9 | −5.7 | −2.8 |
| One Nation, 18–34 | −2.2 | −5.2 | +3.0 |
| Coalition, retired | +15.4 | +8.3 | +2.8 |
| One Nation, retired | −1.5 | +4.7 | −4.2 |
| Coalition, own outright | +11.5 | +7.6 | +2.0 |
| Coalition, TAFE/Tech | −1.2 | +2.7 | −2.4 |
| One Nation, TAFE/Tech | +3.1 | +0.1 | +3.2 |
| Greens, no tertiary | −0.9 | +4.9 | −2.7 |

- **Two different pictures.** Compared with the AES, the polls show:
  - a gender gap half the size (Greens) or reversed (Labor);
  - steeper Coalition gradients by age, retirement and home ownership;
  - a flatter Coalition education gradient;
  - a different One Nation age and retirement profile.
- **Who's right can't be settled here.** No ballot records gender or age. The AES is a recall of the vote actually
  cast and the polls are intentions, so a late break among some groups (Labor was underestimated by 1–4.5 points)
  would look the same as instrument error. What this does settle: a poll-based line can't be measured against the
  AES and called change.
- **The gaps are stable, so this is persistent.**
  - Each house's gaps moved little between the nine months before the campaign and its final five weeks: mean z²
    1.13–1.59 (§5).
  - Every house's Labor gender gap (women − men) sat between −4 and +2 in every year of the term, against the AES's
    +5.3.
- **Design effects.** Measured from consecutive releases: Newspoll 1.31, YouGov 2.23, RedBridge 1.55, Resolve 1.27,
  Essential 1.52.

## 3. The education split (`education-split.mjs` → `out/education-split.txt`)

This answers the second "Reopen if" item of [seat-model/aes-group-swings](../seat-model/aes-group-swings/README.md).
That analysis found the polls' Coalition graduate gap +0.45 logit above the AES's in each house's first
post-election crosstabs, and could not tell instrument from change. Four houses printed education before the
election. Same gap measure (logit graduates − logit everyone else, Census band weights):

| Coalition graduate gap, logit | Mean | SD across houses | Houses |
|---|---|---|---|
| Instrument: pre-election poll − AES | +0.26 | 0.10 | 4 |
| First post-election crosstabs − AES (poll-gaps) | +0.45 | 0.08 | 3 |
| Change, first post-election − pre-election, same house | +0.15 | 0.12 | 3 |
| Change, latest window − pre-election, same house | +0.34 | 0.06 | 4 |

- **Mostly instrument at first.** About 60% of the +0.45 was there before the election.
- **The real shift since the election is about +0.34,** not the +0.60 read against the AES.
- **Graduates were already moving during the campaign.** Each house's gap fell about 0.15 between its pre-campaign
  months and the final five weeks, so the final window is the baseline.
- **Seat effect: still negligible.** aes-group-swings' table puts +0.17 at Coalition 30.1 seats and +0.60 at 29.8,
  so +0.34 is about 30.0. Its verdict stands.

## 4. The site's election test (`site-claims.mjs` → `out/site-claims.txt`, `out/prepoll-groups.json`)

gen-data §7gb's election test compares each group's current gap with the AES's. The live rows (data-late
5ea811ab) are re-asked here against the polls' own election-time gaps on the site's bands. Age 35–54 and 55+ are
read off the four-band tables with the site's own `ageStandardise`.

| Claim the site may cite today | AES test: d (±95%) | Same instruments: d′ (±95%) |
|---|---|---|
| Coalition, University | +7.1 ±4.8 | **+4.0 ±3.5, holds** |
| Greens, gender gap narrowed (men / women) | +3.4 / −3.7 | +1.0 ±1.4 / −0.8 ±1.5, no change |
| Greens, Year 12 or less | −5.6 ±4.7 | +0.2 ±2.3, no change |
| Others, gender gap reversed (men / women) | −3.8 / +3.6 | **−1.9 ±1.3** / +1.2 ±1.4, men hold |
| Others, own outright | −3.7 ±3.4 | −0.5 ±2.3, no change |
| Others, Gen Z | +10.3 ±3.8 | no pre-election generation cut |
| (withheld) Labor gender gap | +3.8 / −3.7 | +0.6 ±2.0 / −0.6 ±1.9, no change |

- **Changes only the same-instrument test finds.** The AES's flatter age gradient hides them:
  - Coalition 18–34 +7.6 ±2.8 and 55+ −6.7 ±2.5.
  - One Nation 18–34 −8.7 ±2.6 and 55+ +5.9 ±3.4.
  - One Nation University −5.4 ±3.2.
  - Greens University +3.1 ±2.8.
  - Retired and part-time movements.
- **Where the instruments disagreed at the election.** Fifteen cells differ beyond both margins at the election
  itself, listed at the end of the report.
- **Caveats.**
  - The pooled pre-election gap mixes the houses that printed each cut. The current figure pools today's houses.
    Group-level house effects were small in the final window (Q/df ≈ 1–2), so this leaks little.
  - The ratio half of the site's test isn't repeated.
- **Recommendation, not made.** Measure "since the election" from the polls' own election-time gaps where a cut
  exists (every set but generation), keep the AES diamonds as the AES's reading, and fall back to the AES for
  generation. This would reverse the 2026-11-02 ruling, so it waits for the owner.

## 5. The seat model (`house-baselines.mjs`, `seats-rebase.mjs` → `out/`)

- **State deviations.** vote-layer.mjs reads every house but Resolve as a level gap from the count. Taking YouGov's
  and Newspoll's election-time state deviations off theirs makes them differences-in-differences like Resolve. It
  moves SA's Coalition deviation +1.7 → +2.9 and One Nation's −1.3 → −2.1, and little else. Seats: nowcast ALP
  71.4 → 71.3, L/NP 30.3 → 30.2, ON 36.6 → 36.7, no flips. The forecast is unchanged.
- **Age and gender β.** These rest on Resolve's single 3 May 2025 wave. That wave's Labor gender gap (women − men
  −5) was further from even than Resolve's own 2022–24 mean (−1). So most of the "widening since the election" that
  Resolve's β reads is Resolve returning to its norm. The gender term moves any seat by at most 0.12 points
  (aes-group-swings §4), so this is left alone. A multi-house baseline from this table is possible if the term ever
  matters more.
- **Education.** See §3. No change.

## Files and rerunning (from the repo root)

- **`extract-bludgertrack.mjs [current.xml]` → `bludgertrack-2022-25.json`.** Fetches the live feed when no file is
  given. The table is 1,722 rows; leaders and trend charts are not kept.
- **`aes-cuts.py <2_AES2025_CSV_100279_general.csv>` → `aes-cuts.json`.** The ADA respondent file is licensed and not
  committed (`~/Downloads/doi-10/`).
- **`lib.mjs`.** Shared readers, the release checks, gaps and variances, and the AEC count by state and class from
  `.build/aec-flow-src/booth/oracle/fpvvt-2025.csv.gz`.
- **Reports:**
  - `node .build/analysis/group-poll-error-2025/group-error.mjs > …/out/group-error.txt` (also writes
    `out/group-error.json`)
  - `node .build/analysis/group-poll-error-2025/education-split.mjs > …/out/education-split.txt`
  - `node .build/analysis/group-poll-error-2025/house-baselines.mjs > …/out/house-baselines.txt`
  - `node .build/analysis/group-poll-error-2025/seats-rebase.mjs > …/out/seats-rebase.txt` (reads
    `model/data/inputs.json`, so it moves with each daily run)
  - `node .build/analysis/group-poll-error-2025/site-claims.mjs > …/out/site-claims.txt` (reads the built dataset
    named in `index.html`)

## Caveats

- **The feed has errors, and the checks drop them.**
  - Releases whose gender or age samples miss their n by more than 10%: YouGov 14–19 Mar 2025 has shuffled cells,
    plus three YouGov releases from late 2023, YouGov Jan 2025, and RedBridge Feb and Mar 2025.
  - Cells whose primaries imply a 2PP more than 4 points from the one printed beside them: Newspoll's pooled renters
    in Mar–Apr 2025 (ALP 29 beside a 65 2PP), and five 2024 cells.
  - The implied-minus-printed 2PP elsewhere runs −1.3 to +0.9 (5th–95th percentile).
- **Gaps in the houses' crosstabs.** RedBridge prints no One Nation in its crosstabs. Only Newspoll printed income in
  the final window, and only YouGov printed renters once Newspoll's cell was dropped.
- **Band definitions.**
  - "Other" work status and household income are matched by label. The polls' exact definitions aren't printed.
  - The AES's $45–60k and $140–160k bands are split uniformly.
  - Religion can't be cut from the AES general release, and language at home isn't asked.
- **What "error" means.** The AES is a recalled vote and the polls are intentions. Section 2's differences are
  between instruments, not errors of the polls, unless the AES is right, and sections 1–2 show it misses on known
  answers about as often as the polls do.
