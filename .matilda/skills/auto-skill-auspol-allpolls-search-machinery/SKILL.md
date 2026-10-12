---
name: auspol-allpolls-search-machinery
description: "auspol-tracker — the All-polls table search end-to-end (publisher matching shipped d93a7ae, 2026-10-07: 'news24' finds News24's 21 YouGov waves). INPUT lives in rd-allpolls.jsx (.rd-ap-search ~:2472, one-home placeholder 'Search a pollster, a publisher, a date or a figure'), the PREDICATE + haystack live in the d1a1d215 asset's AllPollsView (TESTS['q'] ~:5428, haystack ~:5357, AP_CLIENT_ALIASES ~:3960); row client comes from gen-data ('Self-published' stand-in ~:2765). Token-AND substring semantics, the 'news australia' = 18-rows fuzzy-crossmatch quirk, and the fixture verification pattern (rebuild the haystack from the shipped 9f09dca2 data + assert every client name finds its rows)."
source: auto-skill
extracted_at: '2026-10-07T00:00:00.000Z'
---

# All-polls table search: where every piece lives (verified 2026-10-07)

The search box in the redesign's All-polls section is one input over one
predicate, but the pieces sit in three files:

## Input (render surface)

`rd-allpolls.jsx` `.rd-ap-search` (~line 2472): state (`q`/`setQ`), the
placeholder, the clear `×`. The placeholder is a ONE-HOME string
("Search a pollster, a publisher, a date or a figure" since d93a7ae) —
grep `Search a pollster` finds only this site; nothing else quotes it.
The pin-bar search button (`rd-ap-pins` ~:2420) focuses this input.

## Predicate + haystack (machinery)

`d1a1d215` asset, `AllPollsView` — the redesign hands all filtering to
this view (rd-allpolls.jsx only draws), so there is exactly ONE haystack:

- `TESTS` array (~:5423, comment block explaining `without(f)` counting):
  `["q", (p) => !ql || ql.split(/\s+/).every((t) => p.hay.includes(t))]`
  — EVERY whitespace token of the query must appear in the haystack
  (AND semantics; order-free).
- Per-row `hayParts` build ~:5357-5402: pollster, field label, full date,
  sample, spelt-out month names (both `Feb 2026` and `February 2026`
  forms), all primary/2PP figures, lean, **client (+alias, lines added
  by d93a7ae)**, `tpp3`/`tppAlt`/`tppAlt2` matchup phrase tokens, leader
  nets, seat projection, direction, issues, tag ids. Joined lowercased;
  the hay is then duplicated with `–`→`-` so a typed hyphen matches the
  en dash (`hay + " " + hay.replace(/–/g, "-")`).
- `AP_CLIENT_ALIASES` at module scope right after `POLL_TAGS` (~:3960):
  printed-client lowercase → expansion. Current: `afr`, `smh/age`,
  `australia inst.`. A new abbreviated client belongs HERE; do the
  reverse lookup by checking the live client list (below) before adding.

## The client field upstream

`gen-data.mjs`: `individualPolls` carries
`client: p.client && p.client !== "—" ? p.client : "Self-published"`
(~:2765); the direction-only dirOnlyAll rows get it via `CLIENT_BY_HOUSE`
(~:1883-1910, per-pollster last-seen client, "Self-published" fallback).
The haystack SKIPS "Self-published" (a stand-in, not a name — otherwise
"self"/"published" are noise matches across 57 rows).

Live client census (9f09dca2 data asset, 2026-10-07): Self-published 57,
News24 21, AFR 17, The Australian 17, SMH/Age 16, The Guardian 13,
Capital Brief 9, Daily Telegraph 6, Australia Inst. 3, plus 1-row
clients (New Daily, Climate Council, Herald Sun, News Australia,
Courier-Mail, Amplify, The Chronicle, News.com.au).

## The fuzzy quirk is expected, not a bug

Token-AND + substring means cross-matching: `"news australia"` = 18
rows = the 17 Newspoll rows (`news` from pollster "Newspoll", `australia`
inside client "The Australian") + the 1 "News Australia" row. Also
`"news24"` = exactly the 21 News24 rows, `"news24 newspoll"` = 0
(AND). Don't tighten it — the box deliberately matches everything a row
knows.

## Verification fixture (worked 2026-10-07)

Node one-liner/script (no test is registered in package.json's `npm test`
for the search — test-allpolls-url.mjs/test-cycles-url.mjs stand alone
the same way; the original probe was transient scratch, result recorded
in commit d93a7ae's message): eval the 9f09dca2 data asset, rebuild the
haystack per the shipped logic, assert — every printed client name finds
at least its own row count; the three aliases (`australian financial
review` == `afr` == 17; `smh` / `the age` → 16; `australia institute`
→ 3); `"self-published"` and `"self"` = 0; AND semantics
(`news24 newspoll` = 0). House-style `ok(name, cond, extra)` counter,
`process.exit(1)` on any FAIL.
