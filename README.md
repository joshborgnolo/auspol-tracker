# auspol tracker

`NEW Auspol Tracker (Standalone).html` — a single self-contained page aggregating
published Australian federal voting-intention polling. Open it directly or serve
it anywhere; it has no runtime dependencies and works offline.

## Adding a poll

1. Edit **`data/polls.json`** — the canonical dataset. Field meanings are in
   `data/polls.schema.json`.
   - the poll itself → `polls[]` (`date` = fieldwork END, `dateStart` = start)
   - an ALP-v-One-Nation 2PP → `altTpp[]`
   - leader ratings → `approval[]` / `ppm[]`
   - right-direction / wrong-track → `direction[]`
2. Rebuild:

   ```
   node .build/newtracker/build.mjs
   ```

The build validates before it builds and refuses to produce a page from data
that fails a check. A clean run means clean: known-good oddities (Essential's
undecided-inclusive 2PP, two polls whose published shares don't total 100) are
recorded in the data as `pollsterRules` / `sumNote`, so anything it reports is
new and worth looking at.

### Pollster conventions worth knowing

- **Roy Morgan** publishes two ALP-v-L/NP 2PPs. Store the **respondent-allocated**
  one, not the "previous election preference flows" one. Its combined
  "Independents/Other" goes in `ind` with `oth: null`.
- **Newspoll** and **Resolve** often publish no headline 2PP — leave `tpp_*` null
  rather than deriving one.
- Leadership rows must key to **fieldwork end**, matching their poll. An
  unexplained "leadership-only" row in the build output usually means a date has
  drifted off its poll, not that the firm skipped voting intention.

## Layout

```
data/polls.json          canonical dataset (edit this)
data/polls.schema.json   field documentation
.build/newtracker/
  build.mjs              validate -> derive -> transpile -> inline -> one HTML
  validate.mjs           integrity gate
  gen-data.mjs           derives aggregates, series, change indicators
  template.html          page shell + all CSS
  assets/*.js|jsx        app source (JSX, transpiled at build time)
  fonts/                 latin woff2 subsets, inlined at build time
  vendor/                react production + babel (BUILD TIME ONLY, never shipped)
auspol-polling.html      frozen predecessor, kept for history. Nothing reads it.
```

## Method

The 2PP aggregate is a sample- and recency-weighted, house-effect-adjusted mean
(21-day window, 7-day half-life). The headline carries a 95% interval taken as
the larger of how far the polls in the window disagree and their own sampling
error — and the page labels a month-on-month move that doesn't clear it. No
aggregate can measure error shared across the whole industry, and this one
doesn't claim to.
