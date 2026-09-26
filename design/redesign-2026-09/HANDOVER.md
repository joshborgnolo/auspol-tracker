# Redesign handover — 26 September 2026

Section-by-section redesign mocks for the site. They were started in a cloud session, then reviewed and revised in a local session the same day. Nothing in the site itself has changed yet.

## Where things are

- **The canvas is the source of truth:** https://claude.ai/artifact/2tAJDk5xJ9K2AYzQq7HhDj (private to its owner). It has four canvas pages:
  - **Sections:** one row per section, desktop and phone boards side by side, other states to the right.
  - **Whole page:** the Snapshot page top to bottom, desktop and phone.
  - **Past cycles:** that tab top to bottom, desktop and phone, with its controls and details boards. These boards were made on the canvas; the copies in `canvas/project/` were pulled from it on 27 Sep, and no script here builds them.
  - **All polls:** that tab top to bottom (`AllPollsDesktop1–2`, `AllPollsPhone1–3`), with `AllPollsTable` (a poll opened, filtering, sorting, the other views, Labor v Coalition) and `AllPollsDetails` (the pinned headings, the phone's filter sheet, readouts, dark mode).
- **`canvas/project/`** holds a snapshot of every board and `canvas.json`. The snapshot was taken at the local session's last publish.
- **`gen/`** holds the scripts that build the boards, plus `extract_site_data.mjs`, which refreshes their data.
- **`data/`** holds the figures the boards use, extracted from the built `index.html`.
- **Keep this folder out of `main`.** The site is served from the repo root, so merging it would publish these files.

## Picking this up

1. In your clone, run `git fetch origin && git checkout claude/busy-albattani-3lhy6c`.
2. Start Claude Code in the repo, then open with: "Read design/redesign-2026-09/HANDOVER.md and carry on."

The canvas lives on claude.ai, not on disk. A session with the Artifact tool can publish to it. One without it should edit the files here and publish from a session that has it.

## Rows on the canvas, top to bottom

| Row | Boards | Notes and decisions |
|---|---|---|
| Masthead | `Masthead`, `MastheadMobile` | The status block names the latest poll (YouGov, 15–21 Sep), so the header's date and the sections' "to 21 Sep" agree. The pinned bar drops the next-poll list; that's reversible. Its 2PP figures are in the sans, like the TPP section's. |
| Primary vote | `Main`, `Mobile`, `Interaction` | Built by `gen/primary_build.py` from the site's own figures. The stat row is the 21-day nowcast, ordered by size (One Nation 27.3, Labor 26.8…). The chart draws `aggPrimary`'s monthly aggregates with their 95% intervals. The line ends carry names only, because the figures are in the stat row. |
| Who votes for whom | `Demographics`, `DemographicsMobile`, `DemographicsPlace`, `DemographicsGreens` | Whiskers are the site's 95% margins. Monthly lines use the site's per-group monthly figures. The location chart starts in February 2026, when that series begins. |
| Where One Nation's voters came from | `Switching`, `SwitchingMobile` | The points note quotes the site's 27.3. |
| Undecided | `Undecided`, `UndecidedMobile`, `UndecidedParty`, `UndecidedAge` | |
| Leadership | `Leadership`, `LeadershipMobile`, `LeadershipThreeWay`, `LeadershipBoth`, `LeadershipTablet` | |
| Two-party preferred | `TPP`, `TPPMobile`, `TPPViews` | Owner's calls: no headline (this is the page's headline section). Implied flows against the strongest rival is big and central. "Switch 2PP" gives the other contest. The implied/published switch lives inside the "?" panel, because implied is the strong default. |
| The issues | `Issues`, `IssuesMobile`, `IssuesWhom`, `IssuesWhomMobile` | RedBridge publishes group figures for six issues only, so "What matters to whom" shows six. Its all-voters row is RedBridge's own, which the footer now says. |
| National direction | `Direction`, `DirectionMobile` | The gap annotation's baseline is December 2025, the month before the Bondi shooting (its two polls closed by 14 Dec, level with October and November). |
| Latest and next polls | `Polls`, `PollsMobile`, `PollsViews` | One table, one row per pollster, replaces both Snapshot panels (see the decision below). Essential's change is measured against its 29 June poll. |
| Dark mode | `DarkMode` | Colour tokens, light and dark, for the port. Its charts mirror the light boards. |

On the **Whole page** canvas page, `PageDesktop1–2` and `PagePhone1–3` stack the section boards in the live site's order. A board can be at most 8000px tall, so each page is split into parts.

## Decisions from the review (26 Sep, local session)

- **Latest and next polls stay unified.** The single table is better for finding one pollster's next release beside its last result, for seeing each pollster's rhythm, and for spotting a stale pollster. The split panels are better at one job: listing upcoming polls soonest first. The masthead's "Next polls" strip covers that, and so does making "Next, at the earliest" sortable (state C in `PollsViews`). The cost is that a weekly pollster's later releases appear only as small rings, not dated rows.
- **Monthly lines are straight segments** on every chart. The live site smooths them with cubic curves, which can show highs and lows no month had. When porting, switch the chart engine's curve to straight (or monotone). This is the owner's call if they prefer the smooth look.
- **Bands and whiskers are "95% interval"**, the site's glossary term. The ± figures are "95% margin".
- **Keep the site's motion.** The boards are static, but the port keeps the live site's transitions: when a chart switches view, lines morph into place, colours cross-fade and poll dots slide to their new positions; figures that change in place roll digit by digit. Every tab, toggle and "Switch 2PP" in the redesign should use them.
- **Restated figures quote their source exactly.** For example, the By-party small multiples quote the dot plot's 56.2, not 56.
- **Boards end with the same padding they start with.** Run `gen/preview.py` after edits to check. It measures at natural height, because a fixed-height board silently squeezes content that overruns it.
- **Section headings are a 2px ink rule over a sentence-case title** (22px desktop, 19px phone), with the meta beside or below it; the finding stays the big serif headline. The two-party section has no rule, since it sits under the masthead. The polls section uses the title in place of its old heading.

## All polls (27 Sep)

- **Built like Past cycles.** The same masthead and stylesheet (the generator lifts both from `PastCyclesDesktop1`/`PastCyclesPhone1`), a page header with an on-this-page nav, and headline-first sections under the 2px rule. The table's controls match "Latest and next polls": tabs for 2PP, Primary, Leadership and Direction, and "Two-party: Labor v One Nation ⇄ · implied flows ?" on the right.
- **The headline ties the table to the Snapshot's figure:** "The eight polls that make up Labor's 51.2 run from 49.8 to 52.8". Its rule: the polls in the headline's 21-day window (`latest.onImp.n`), their lowest and highest implied ALP v ON share, and how many have Labor ahead. The deck's "none sits further from the average than its own margin" is computed too.
- **Each row draws its poll against the average of its month.** The centre line is that month's implied aggregate (the site's Poll lean, unchanged). The dot is the poll's lean, red towards Labor, orange towards One Nation (blue on the Coalition contest). The whisker is its 95% interval from sampling alone. The interval uses the poll's primaries and the frozen flows (variance of each respondent's flow to Labor), not p(1−p): about a fifth narrower, roughly ±2.6 rather than ±3.2 for a typical poll. The flows' own doubt is left out because it is the same for every poll.
- **Rows are grouped by month**, with the month's average beside the heading and how many of its polls are in today's figure. Sorting by anything else drops the groups and puts the year on every date. The first view shows whole months (34 polls, back to July) and then "Show earlier months".
- **Dropped from the row:** the tag pills (2PP, PPM, APRV…) and the House effect column. The Includes filter and the opened poll carry the tags; each pollster's lean now has its own section. The Contest filter's rare contests (Coalition v One Nation, three-cornered) move into Includes, and "held by" goes, since sorting by Labor's share does the same job.
- **The four panels became three sections:**
  - How much the polls disagree: one small chart per party, the combined One Nation + Coalition vote among them, because that is the finding (split disagrees, size doesn't).
  - How each pollster leans: one row per pollster, a bar for its lean now and a line for its lean by month.
  - Preference flows: both contests side by side, with the pooled "now" reading drawn at the right edge so the chart shows the figure the text quotes.
- **Worth checking at the port:** the site's disagreement floor for the implied 2PP uses the simple-share formula, which overstates sampling error by about a quarter. On that basis the implied 2PP's 0.78× ("herded") would read nearer 1×. The Primary vote tab, the section's default, is unaffected.

## Still open

- **The port hasn't started.** The earlier question to the owner was whether to start it on this branch. There's no answer yet.
- **`origin/main` is ahead of this branch** (Issues: Ipsos and DemosAU added). Bring it in before porting.
- **Headlines and decks are written by hand.** The site generates its own, so each one needs a rule. On "What matters to whom" the deck should be the chosen group tab's verdict sentences, as the site's are now.
- **The canvas title** still reads "Primary vote chart redesign", from when it covered one chart.

## Working on the boards

- **Generated boards** (edit the script, not the board):

  | Script | Boards |
  |---|---|
  | `gen/primary_build.py` | `Main`, `Mobile`, and the chart in `Interaction`'s first state |
  | `gen/build2.py` | `TPP*` (run `gen/geom.py` first if the data changed) |
  | `gen/issues_build.py` | `Issues*` |
  | `gen/direction_build.py` | `Direction*` |
  | `gen/masthead_build.py` | `Masthead*` |
  | `gen/polls_build.py` | `Polls*` |
  | `gen/page_build.py` | `PageDesktop*`, `PagePhone*`. Run it last, after any board changes. |
  | `gen/allpolls_build.py` | `AllPolls*`, and the All polls page's entries in `canvas.json`. Refresh its data first with `node design/redesign-2026-09/gen/extract_allpolls_data.mjs`; board heights live in `gen/allpolls_heights.json`. |

  Run them with `python3 design/redesign-2026-09/gen/<script>.py`. They write into `canvas/project/` and reproduce the committed boards byte for byte. Set `PYTHONDONTWRITEBYTECODE=1` so no `__pycache__` lands in the tree.
- **Hand-written boards:** everything else. Edit the `.dc.html` directly. `gen/calc.py`, `calcm.py` and `demo.py` are the first session's geometry scripts. They're kept for the record; nothing current depends on them.
- **Previewing:** `python3 design/redesign-2026-09/gen/preview.py [--scale 2] [Board ...]`. It writes static copies and screenshots to `.matilda/redesign-preview/` (gitignored). It also prints where each board's content ends and flags any board whose height leaves uneven padding.
- **Refreshing data:** `git show origin/main:index.html > /tmp/index_main.html`, then `node design/redesign-2026-09/gen/extract_site_data.mjs /tmp/index_main.html`.
- **Board format:**
  - Keep `<script src="./support.js"></script>` in the head.
  - Content goes inside `<x-dc>` with a `<helmet>` for fonts and styles.
  - The root `div` is fixed to the board size and matches `$preview` in `data-props`.
  - Nothing on the board is built from script.
- **Publishing with the Artifact tool:** set `url` to the canvas link, `root` to `design/redesign-2026-09/canvas`, and `file_path` to `.../canvas/project/canvas.json`. In `files`, map `"project/X.dc.html": "project/X.dc.html"` for each changed board. Read `canvas.json`, and any board you change, back from the artifact first: the canvas app adds fields, and boards may have been edited on the canvas. Also read the artifact itself (`read` with just the `url`): a publish is refused until you have, even if you've read files from it.
