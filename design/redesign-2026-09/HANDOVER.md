# Redesign handover — 26 September 2026

Section-by-section redesign mocks for the site, made in a cloud session and handed over here so the work can carry on locally. Nothing in the site itself has changed yet.

## Where things are

- **The canvas is the source of truth:** https://claude.ai/artifact/2tAJDk5xJ9K2AYzQq7HhDj (private to its owner). One row per section, desktop and phone boards side by side, other states to the right.
- **`canvas/project/`** holds a snapshot of every board and `canvas.json`, taken from artifact version `1790429655-cd43` (the first snapshot was `1790397796-b6c4`; every board had been edited on the canvas since, and the Whole page and Past cycles pages were added).
- **`gen/`** holds the scripts that generate some of the boards, and `extract_site_data.mjs`, which refreshes their data.
- **`data/`** holds the figures the boards use, extracted from the built `index.html`. The Issues and National direction data come from `origin/main`, the rest from this branch.
- **Keep this folder out of `main`.** The site is served from the repo root, so merging it would publish these files.

## Picking this up locally

1. In your clone, run `git fetch origin && git checkout claude/busy-albattani-3lhy6c`.
2. Start Claude Code in the repo: either the Claude Desktop app, or `claude remote-control` in a terminal there, which then shows up in the Claude Code app.
3. Open with: "Read design/redesign-2026-09/HANDOVER.md and carry on."

The canvas lives on claude.ai, not on disk. A local session can keep publishing to it if it has the Artifact tool. If it doesn't, edit the files here and publish from a web session.

## Rows on the canvas, top to bottom

| Row | Boards | Notes and decisions |
|---|---|---|
| Masthead | `Masthead`, `MastheadMobile` | Status block names the latest poll (YouGov, 15–21 Sep) so the header's date and the sections' "to 21 Sep" agree. The pinned bar drops the next-poll list; that's reversible. |
| Primary vote | `Main`, `Mobile`, `Interaction` | Figures come from a 28-day trend (Labor 27.3, One Nation 26.5), not the site's 21-day estimate (One Nation 27.3, Labor 26.8); use the site's when porting. The One Nation line colour `#DD9231` is 2.4:1 against the background; use `#CC7C37`. |
| Who votes for whom | `Demographics`, `DemographicsMobile`, `DemographicsPlace`, `DemographicsGreens` | Phone: the dashed all-voters line no longer crosses the figures. |
| Where One Nation's voters came from | `Switching`, `SwitchingMobile` | "50%" labels moved clear of the chart titles. |
| Undecided | `Undecided`, `UndecidedMobile`, `UndecidedParty`, `UndecidedAge` | |
| Leadership | `Leadership`, `LeadershipMobile`, `LeadershipThreeWay`, `LeadershipBoth`, `LeadershipTablet` | |
| Two-party preferred | `TPP`, `TPPMobile`, `TPPViews` | Owner's calls: no headline (this is the page's headline section). Implied flows against the strongest rival is big and central. "Switch 2PP" gives the other contest. The implied/published switch lives inside the "?" panel, because implied is the strong default. |
| The issues | `Issues`, `IssuesMobile`, `IssuesWhom`, `IssuesWhomMobile` | Built from `origin/main` data. To settle before porting: "a third name none of the three" is a plain average of five polls, not a site figure; the ▲▼ rule differs from the site's between-group test; the chart (September monthly) and table (six-week pool) rank Labor differently. |
| National direction | `Direction`, `DirectionMobile` | "5 points apart in May 2025" rests on one Essential poll. |
| Latest and next polls | `Polls`, `PollsMobile`, `PollsViews` | One table, one row per pollster, replaces both Snapshot panels. Essential's change is measured against its 29 June poll. |
| Dark mode | `DarkMode` | Colour tokens, light and dark, for the port. |

The canvas has three pages: **Sections** (the rows above), **Whole page** (the Snapshot page stitched top to bottom) and **Past cycles**.

| Past cycles page | Boards | Notes and decisions |
|---|---|---|
| The page, top to bottom | `PastCyclesDesktop1`, `PastCyclesDesktop2`, `PastCyclesPhone1`–`3` | The Past cycles tab in the Snapshot's grammar: the same masthead with its own tab current, the same section anatomy and chart language, and the Snapshot's section order (two-party preferred, primary vote, leadership), then how the final polls did. It opens on a summary table: each of the tab's six measures 16 months in, drawn as a slice through its fan, with the gap to the average, a rank, and a link down to its chart. The fan is warm grey, like every other interval on the page, in place of the tab's purple. |
| How it moves | `PastCyclesControls`, `PastCyclesDetails` | One comparison control for the whole page (All / Re-elected / Turned out, Level / Change since election, Draw a past term) instead of a Cycles button under each chart. Its states: the two outcome sets, the term picker, drawn terms, the polls under three lines, change since election. Scrolled down, a section bar pins under the site's bar with a link to each section and the same controls. Also the readouts, and dark twins for the new `--band` and `--band-thin`. |

Standing rules from the owner:
- Every chart keeps its copy-chart button (and expand).
- Copy is in Australian English.

## Still open

- **The port hasn't started.** The last question to the owner was whether to start it on this branch. There's no answer yet.
- **`origin/main` is four commits ahead of this branch** (Issues: Ipsos and DemosAU added; a re-election model refresh). Bring it in before porting.
- **Headlines and decks are written by hand.** The site generates its own, so each one needs a rule. On the Past cycles boards the figures come from the same month-16 pooling the tab uses (`standing()` in `gen/cycles_build.py`) but the words are written by hand; the top headline, for instance, would need a rule such as "both primary-vote rows rank lowest, or highest, of every term".
- **Past cycles, to settle before porting:** the summary table, the single shared control and the pinned section bar are new patterns; "Re-elected" and "Turned out" rename the tab's "Returned" and "Ousted"; the site shows every chart's events, the boards label them on full-width charts and number them on narrow ones, as the Snapshot does.

## Working on the boards

- **Generated boards:** `TPP*` (`gen/build2.py`, after `gen/geom.py` if the data changed), `Issues*` (`gen/issues_build.py`), `Direction*` (`gen/direction_build.py`), `Masthead*` (`gen/masthead_build.py`) and `Polls*` (`gen/polls_build.py`). Run them with `python3 design/redesign-2026-09/gen/<script>.py`; they write into `canvas/project/`. Each reproduced its board byte for byte at the first snapshot, but the boards have since been edited on the canvas, so running one now would undo those edits: carry them into the script first.
- **Past cycles boards:** `PastCycles*` come from `gen/cycles_build.py`, which reads `data/cycles.json`. The tab computes its bands in the page, so `gen/extract_cycles.js` reads them from the running site with the page's own functions: serve the repo (`node .claude/serve.js`), then run it. Board heights come from `gen/measure_cycles.js`: build, measure, build again. `python3 design/redesign-2026-09/gen/cycles_build.py --canvas design/redesign-2026-09/canvas/project/canvas.json` adds the Past cycles page to an index read back from the canvas.
- **Hand-written boards:** everything else. Edit the `.dc.html` directly. `gen/calc.py`, `calcm.py` and `demo.py` computed some of their geometry and must be run from the repo root.
- **Refreshing data:** `git show origin/main:index.html > /tmp/index_main.html`, then `node design/redesign-2026-09/gen/extract_site_data.mjs /tmp/index_main.html`.
- **Board format:**
  - Keep `<script src="./support.js"></script>` in the head.
  - Content goes inside `<x-dc>` with a `<helmet>` for fonts and styles.
  - The root `div` is fixed to the board size and matches `$preview` in `data-props`.
  - Nothing on the board is built from script.
- **Publishing with the Artifact tool:** `url` is the canvas link, `root` is `design/redesign-2026-09/canvas`, `file_path` is `.../canvas/project/canvas.json`, and `files` maps `"project/X.dc.html": "project/X.dc.html"` for each changed board. Read `canvas.json`, and any board you change, back from the artifact first: the canvas app adds fields, and boards may have been edited on the canvas.
- **Comments:** all comment threads on the canvas were answered and resolved at handover.
