---
name: auspol-missing-poll-triage
description: auspol-tracker — a user reports "poll X isn't in past-cycle Y / the accuracy panel": triage by probing the four data layers BEFORE doubting the data (cyclePolls keyed term-END → cycle-source sidecar keyed term-START c.year → D.accuracy in the 9f09dca2 asset → live curl grep). The two display rules that make present data look absent are label-direction (accuracy rows are labelled by the election CALLED, e.g. 2007 elections sit under year:2007 while their cycle rows live in cyclePolls.2007/sidecar key "2004") and the accuracy panel showing each house's FINAL poll only — a mid-campaign wave from a news article appears in the cycle chart/sidecar but never in "How the final polls did". Includes the cadence heuristic (Newspoll fortnightly ≈2.0 wk/wave) for "how much is missing" answers. Plus the new-house-debut case (AGB McNair 2026-09-04): rows on the OLDEST term cards look absent because the term carousel opens scrolled to the most-recent term; a debuting house gets no dedicated section (rows blend into existing boards as party-coloured dots — no per-firm colour map exists on cycle boards); primary-only rows (tpp null by design) render only as primary-vote dots and never in the 2PP/accuracy views; and `grep -c` on the minified sidecar counts LINES (returns 1) — count occurrences with `grep -o '<firm>' | wc -l`.
source: auto-skill
extracted_at: '2026-09-03T08:05:44.137Z'
---

# "That poll isn't on the site" — past-cycle triage (auspol-tracker)

Worked example (2026-09-03): user links a 17 Nov 2007 Age write-up of a
Newspoll and asks why no Newspoll appears in the 2007 election's "How the
final polls did". Answer: it does — but only two checks proved it.

## Triage ladder (fastest check first, all from the shell)

1. **Canonical rows** — `cyclePolls` in `data/polls.json` keyed by TERM-END
   election: `j.cyclePolls['2007']` = polls between the 2004 and 2007
   elections. Count waves per firm and print the tail per firm. The poll
   the user cites is usually there; date it sits under is fieldwork END,
   which can be a day or two off the article's date (the 17 Nov Age
   article's Newspoll is row `2007-11-18`).
2. **Cycle-source sidecar** — `assets/cycle-source.<hash>.json` (hash from
   `grep -o 'cycle-source\.[0-9a-f]*\.json' index.html`) is keyed by
   **TERM-START** election (`c.year`), the OPPOSITE direction: key `"2004"`
   holds the 2007-election cycle's polls (2004-10-17 → 2007-11-24); key
   `"2007"` holds 2008→2010. Reading the wrong-direction key and finding
   "other" dates is the session's actual stall — check the inspect-printed
   first/last dates of each key before concluding anything.
3. **Accuracy block** — `D.accuracy` in the `9f09dca2` data asset: rows
   labelled by the election being CALLED (`year: 2007, eDate: 2007-11-24`),
   `houses[]` = each house's FINAL pre-election poll (one per firm; last
   2PP poll inside ACC_WINDOW_DAYS = 14 before polling day).
4. **Live site** — `curl -s https://auspoltracker.com/ | grep -o
   '<eDate>","alp2pp":<v>'`. Date/number literals grep cleanly in the built
   HTML (only curly typography is babel-escaped).

## Why a poll the user CAN see in the news looks absent on the site

- **The accuracy panel shows one row per house — the FINAL poll.** A
  mid-campaign wave (the Age's 17 Nov Newspoll 54-46) is plotted in the
  Past-cycles chart and sits in cyclePolls + sidecar, but "How the final
  polls did" prints only Newspoll's 22 Nov final (52-48, err −0.7).
  Point the user at the final's date; the mid-campaign wave is findable
  in the cycle chart / source-polls CSV.
- **Label direction.** Asking "where's the 2007 Newspoll" while scanning
  `cyclePolls.2007`... that's correct, but the SAME election's sidecar
  data hides under key `"2004"` and its accuracy row under `year: 2007` —
  keyed three ways in three places (see auspol-past-cycles keying quirks:
  src = term-END rows, appr/year = term-START).

## "How much <house> data are we missing?" — cadence heuristic

Compare wave count + span against the house's publication cadence with a
one-liner: Newspoll 2007-cycle = 78 waves, 2004-11-21 → 2007-11-22,
≈2.0 weeks/wave = exactly fortnightly ⇒ complete. A house's frequency
(weekend cadence, summer hiatus) sets the expected density; a gap longer
than ~2× cadence is the real missing-data signature, not a user-visible
absence in one panel. Cross-check against `data/newspoll-*.csv` (the
reference series gen-data draws with) when counts are in dispute.

## A new house debuts on the OLDEST boards and looks absent (2026-09-04, AGB McNair)

User: "what mcnair polls did u add — can't see any in past cycles" — all
four data layers were green and the rows had been live for hours. The
invisibility was five display facts, none a defect:

1. **No debut section exists.** Past cycles has no per-house board — a
   debuting house's rows merge into the EXISTING term cards as extra
   dots. The firm name shows only in dot-hover/ledger text; nothing on
   the page announces "McNair".
2. **The term carousel opens scrolled to the MOST-RECENT term.** Rows on
   the oldest cyclePolls windows (1990/1993 terms) sit on cards far
   off-screen left — the default view proves nothing; the user must
   scroll the carousel all the way to the oldest cards.
3. **Primary-only rows can never appear in the 2PP or accuracy views,
   by design.** This house printed no 2PP in the corpus, so its rows
   carry `tpp: null`: they render as ALP/Coalition/oth primary dots
   only, with zero presence on a 2PP chart and permanent absence from
   "How the final polls did" (the panel is final-2PP-only). Any house
   admitted from partial-slate historical evidence is likely in this
   class — tell the user to look at the PRIMARY dots.
4. **Which card holds a row**: CYC_META maps card → data key via `src:`
   (term-END): Jan–Feb 1993 rows (cyclePolls.1993) sit on the **1990**
   card's RIGHT edge; Apr–Sep 1993 rows (cyclePolls.1996) open the
   **1993** card. Card labels come from `grep -n "year: <term-start>"
   .build/newtracker/gen-data.mjs` (pm field gives "Hawke → Keating"
   style names).
5. **No renderer/display change is needed for a new cycle firm.**
   Verified by grep: no `FIRM_*` colour/naming map exists anywhere in
   `.build/newtracker` (HOUSE_RENAMES in gen-data covers display
   renames only); cycle-board dots are party-coloured and firm-agnostic,
   so a brand-new firm string renders correctly with zero display work.
   Don't chase a "missing colour entry" as the cause of invisibility.

Probe trap that nearly produced a false "not deployed": `grep -c "AGB
McNair" assets/cycle-source.<hash>.json` returns **1** on the minified
single-line JSON even with 8 rows inside — count occurrences with
`grep -o '<firm>' | wc -l`. The single fastest proof for this whole
class is one live curl: `curl -s https://auspoltracker.com/assets/
cycle-source.<hash>.json | grep -o '<firm>' | wc -l` (hash from the live
page's `cycle-source\.[0-9a-f]*\.json` reference).

## Response shape

Verify all four layers first (90 s of shell), then reply: what's present
where, WHICH row represents the article they linked (mapped by fieldwork
window, not article date), and the correct entry point on the site. Only
after all four layers come up empty start a data-gap hunt.
