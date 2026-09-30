---
name: auspol-age-vs-generation-reading
description: auspol-tracker — answering "should I describe party X's voters as 55+ or Gen X?" (and similar voter-base characterisations) from the site's own data. Gen X (born 1965–1980, ages 46–61 in 2026) STRADDLES every pollster's published age cut, so generation-set figures are modelled by harmonize() while 55+ is directly measured — prefer the band claim. How the age tables sit in data/demographics.json, how to read the panel's exact harmonised values (window.AUSPOL node probe or headless #who-votes probe), and the worked 2026-09-30 One Nation reading (55+ 34.2% > Gen X 33.1% > Boomers 30.1%).
source: auto-skill
extracted_at: '2026-09-30T07:54:20.033Z'
---

# Characterising a party's age base: band (55+) vs generation (Gen X)

Worked 2026-09-30 for "should I say One Nation voters are more likely to be
55+, or gen x?" — the rule generalises: when a pollster-agnostic age BAND
and a generation label compete, the band is the defensible claim and the
generation figure is a modelled estimate.

## The structural trap: generations never align with published age cuts

- Pollster age tables in `data/demographics.json` (`waves[].details.age`)
  use the standard 3-band cut **18–34 / 35–54 / 55+** (Resolve, DemosAU,
  RedBridge) — except **YouGov**, which publishes 18–34 / 35–49 / 50+.
  Roy Morgan's demographics waves carry no `age` dim at all (checked
  2026-09-27).
- RD_GEN_BORN generations are **Pew birth ranges** (Gen Z 1997–2012,
  Millennials 1981–1996, Gen X 1965–1980, Boomers 1946–1964) — voter-
  clamped ages in 2026: Gen Z 18–29, Millennials 30–45, **Gen X 46–61**,
  Boomers 62–80. See auto-skill-auspol-gen-born-brackets.
- Gen X (46–61) therefore **straddles the 35–54 and 55+ buckets**; no
  published age table isolates it. The Generation set's pooled figures
  come entirely from `harmonize()` in `demo-groups.mjs` (harmonises
  pollsters up to 3 bands, then a Bayesian shrink ζ ≈ 2/n spreads, e.g.,
  a 4-band poll across "35–54" — de-harmonising that site-side smoothing
  is questionable). Treat generation values as inferred, band values as
  measured, when writing public copy.

## How to read the panel's exact harmonised numbers

`demographics()` in gen-data.mjs (~:2599–2712) pools each group's series
with `nowcastPts`/`weightedWithSe`; the payload lands at
`window.AUSPOL.demographics.tabs[] → sets[] → groups[] → v/ci` (the full
probe recipe, incl. DEMO_KEYS order, is in
auto-skill-auspol-vote-by-group-all-voters-anchor). Two working pulls:

1. **window.AUSPOL under node** (fastest; from the anchor skill):
   `D.demographics.tabs.find(t=>t.id==="age").sets` — set id `gen` carries
   the four generation groups; set `age` the three bands.
2. **Headless-page probe** — `.matilda/onp-age-probe.mjs` (gitignored,
   written this session; modelled on gen-born-probe.mjs): serves the repo
   on :8946, loads headless Chrome, reads `#who-votes .rd-wv-row` text for
   both the band rows and the generation rows in one pass. Use when you
   want what a *visitor* sees (the Age tab shows both sets at once; the
   party chips sit in the `.rd-wv-dots` picker row — default was One
   Nation).

Grep dead-ends to skip: there is no `byAge` symbol in gen-data.mjs worth
chasing, index.html has no `<script src=assets/...>` (the page loads
hashed layers differently), and `grep -n 'const emit' gen-data.mjs` gets
you nowhere — go via `window.AUSPOL.demographics` or the browser probe.

## The 2026-09-30 One Nation reading (will drift; the logic won't)

Raw per-house latest waves, onp primary by age:

| wave | 18–34 | mid | oldest band |
|---|---|---|---|
| Resolve 2026-09-13 | 17.2 | 24.4 (35–54) | **35.5** (55+) |
| DemosAU 2026-09-14 | 16 | 27 (35–54) | **31** (55+) |
| YouGov 2026-09-21 | 18 | 28 (35–49) | **31** (50+) |

Site's harmonised Age tab (party = ONP, all-voters anchor ≈ 26.9):
18–34 **16.6**±2.2 · 35–54 **25.2**±4.1 · 55+ **34.2**±3.4 (+7.3 v all)
· Generation set: Gen Z 10.1±4.8 · Millennials 26.8±4.4 ·
**Gen X 33.1±3.8** · Boomers 30.1±4.1.

Judgment rule that followed:
- Every house's table rises monotonically and peaks in its oldest
  published band → "**55+**" is copy-safe: directly measured, aggregate
  gap vs all voters is the biggest in the panel (+7.3pts).
- "**Gen X**" is the top *generation* estimate (33.1, above Boomers
  30.1) but it is modelled off a bucket straddle, and its ~3pt edge over
  Boomers sits inside overlapping margins (±3.8 / ±4.1). Fine as colour,
  risky as the headline.
- Honest middle position if generations are wanted: "strongest among Gen
  X and Boomers."
- The flip-side line is at least as strong a story: ONP is far WEAKER
  under 35 (16.6%; Gen Z 10.1, -16.8 v all voters).
