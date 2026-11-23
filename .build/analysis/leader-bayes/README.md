# Leadership model: fits and backtests (2026-11-23/24)

The evidence behind the site's leadership model
(`.build/newtracker/leader-model.mjs`, gen-data §4m, live as 422a2ea8). The
`leader-model.mjs` here is the prototype the production engine was copied
from. Production adds the per-house compression, history lines and draws.

Run from this folder. `readings.json` is generated and not committed, so make
it first:

```
node readings.mjs > readings.json   # every leader reading 1971–, persons by date from gen-data's CYC_META
node fit.mjs ratings                # combined v approval-only v favourability-only v the old recipe → fit-ratings.json
node fit.mjs ppm                    # preferred PM, decided basis, 2PMP as its own house v as Newspoll → fit-ppm.json
node combine.mjs                    # approval and favourability: one line, two lines, or two correlated lines
node roles.mjs                      # settings per role/era v pooled
node trend-test.mjs                 # a damped trend term (rejected)
node age-test.mjs                   # faster movement early in a stint (rejected)
```

## Findings

| question | result |
|---|---|
| Next-poll error, net ratings 1971–2026 | model 4.23 v recipe 4.59 net points; this term 3.75 v 4.42 |
| Next-poll error, preferred PM | 2.20 v 2.52 share points; 2022– 1.95 v 2.58 |
| 95% bands | catch 94–96% of the next polls |
| Approval and favourability: one line or two? | One. Favourability polls are predicted better by the shared line (3.66 v 4.28). Approval polls are the same either way (3.92 v 3.85). Two lines with correlated moves (ρ up to .95) do no better. Resolve asks both questions of the same leader in one poll: they differ by 1–4 points. |
| Unsure shares | each house's net is scaled by (1 − its unsure share) / (1 − the regular houses'), so a poll with many unsure doesn't read as a smaller net |
| Preferred PM basis | the PM's share of those who chose one of the two, like the 2PP. Newspoll's forced 2PMP (47–53) fits as its own leaning house |
| Trend term | no gain in error or likelihood |
| Faster early in a stint | no gain |

## fav-research/

A background audit of the history in `data/polls.json`:

- `cycleApproval-classification.csv`: every past firm and cycle classified as
  approval/satisfaction or favourability. All of it is approval/satisfaction
  except CT Group's 2023 wave, since marked `"metric": "fav"`. Lonergan
  2013-08-17 looks like a copy of Newspoll's poll from the same weekend.
  ReachTEL used a five-point performance scale.
- `favourability-history.csv`: favourability polling before 2022. Only three
  YouGov waves in 2017. The Freshwater 2022-12-18 reading (+17) isn't filed.
- `aes-leader-like-dislike.csv`: the Australian Election Study's 0–10
  like/dislike scale, once per election from 1987. It's the only long
  favourability-type series.
- `wiki-fav-rows.raw.csv`: the raw Wikipedia rows the audit read.
