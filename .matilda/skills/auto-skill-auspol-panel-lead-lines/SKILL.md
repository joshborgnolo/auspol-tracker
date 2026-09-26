---
name: auspol-panel-lead-lines
description: auspol-tracker — the "one-sentence gist lead" pattern over a panel/section (shipped across 71b7e27 and neighbours, un-bolded + pure-black #000 in 73efb6a, <mark>-wrapped organic highlighter pass in 6334b4e via box-decoration-break: clone — all 2026-09-24): a plain-weight dynamic sentence (dir-lead/ons-lead/und-lead/ld-lead/pv-lead family, ONE shared CSS rule in template.html with body.dark overrides) composed at render time from live readings, NULL-rather-than-guess when data is missing, qualitative phrases behind deadbands ("neck and neck" gap<2, "fairly constant" |d|<1, "left behind" >2 behind second place), and 2025-05 as the May-2025-election baseline month. When the user asks "add a similar line for X", follow this recipe.
source: auto-skill
extracted_at: '2026-09-24T07:42:30.008Z'
---

# Panel gist lead lines (the "*-lead" family)

Recurring request shape: "add a similar line for &lt;panel&gt;, dynamic like the others" —
a sentence in the panel's own voice, computed from live figures so it stays true as
data turns over. Five homes shipped on 2026-09-24 (commits 71b7e27, plus 9025ec4 /
b478f31 / 88aaf46 nearby), all in the `a11e1559-f455-…` asset. Weight history: launched
with `<b>` wrappers, un-bolded same-day in 73efb6a ("make them not bold"). Since 6334b4e
every lead's CONTENTS sit inside one `<mark>` element (the organic highlighter — CSS
below), so renders read `{lead && <p className="x-lead"><mark>{lead}</mark></p>}`; the
`<mark>` hugs the whole sentence INCLUDING computed fragment children:

- `dir-lead` — DirectionPanel (~:1422): `<mark>{plainShare(latest.wrong)} Australians believe we're on the wrong track.</mark>`
- `ons-lead` — vote-switching panel (~:1675): `<mark>` wraps the text + rated-toggle ternary (its two `<>…</>` fragments) as one run
- `und-lead` — UndecidedPanel: `termLead` IIFE after `const spine = drawn[0].pts;`, rendered between the und-reads tiles and the TrendChart
- `ld-lead` — LeadershipSection (~:467): `ldLead` IIFE after `const leaders = D.LEADERS;`
- `pv-lead` — PrimaryVotePanel (~:244 IIFE, ~:330 render): `pvLead` IIFE after `const pts = filterPts(D.aggPrimary, …)`, rendered between the card-head close and `<TrendChart key="pv">` (the static `card-sub` "First-preference support, poll aggregate" was deleted when the lead arrived)

ONE shared CSS rule in template.html (~:2695, TWO rules since 73efb6a):
`.ons-lead, .dir-lead, .und-lead, .ld-lead, .pv-lead { margin: 0 2px 12px; font-size: 15px; line-height: 1.55; color: #000; text-wrap: pretty; }`
plus `body.dark .ons-lead, … { color: var(--ink-2); }` — a hardcoded colour on a text
rule MUST carry a body.dark escape back to a token (pure black vanishes on the dark
ground); the same constraint applies to any future "just black/white" request here.
Add a new class to BOTH selector lists — don't fork a rule. Panel-specific air is a
third override rule (`.dir-lead { margin-bottom: 22px; }` was the worked case: more
space before the right/wrong readout bar).

## Recipe (conventions that keep the family consistent)

1. **Compose at render time, from live readings.** Sources seen so far: `D.latest.primary`
   (shares), `leaderReading(D.leaderMonths, id+"_net"|+ "_pref")` (leaders — returns null-safe
   `{v,ym,prev,…}` with leaderNow → monthly fallback), series `monthly` arrays for baselines.
2. **Return `null` rather than guess.** Every IIFE checks for missing leaders/series/rows and
   returns null; the render is `{lead && <p …>}`. A panel degrades to no sentence, never
   to a wrong one.
3. **Qualitative words sit behind deadbands.** "neck and neck" = top-two gap `< 2` pts;
   "fairly constant" = `|now − baseline| < 1`; "left behind" = > 2 pts off second place.
4. **The election baseline is the May-2025 month.** Undecided's anchor:
   `monthly.filter(m => m.ym <= "2025-05").pop() || monthly[0]`, guarded by
   `monthly.some(m => m.ym > "2025-05")` so a young series hides instead of faking a
   comparison. Months spell out via `window.AP.monthLabelFull(ym)`.
5. **Round-numbers in prose, one decimal in figure slots.** `ld-lead` uses
   `Math.round` for the 42–38 style gap and net figures ("on −25"); `pv-lead` uses
   `toFixed(1)` for named shares ("on 21.2%").
6. **Branch phrasing on who leads** (PM-ahead vs opp-ahead both composed; never assume the
   current ordering survives in all branches).
7. House/party names come from the data (`p.name`, `L.short`), never re-typed literals —
   `D.PARTIES.lnp.name` is "Coalition", so `"the " + lnp.name` reads right.

## Copy moves that shipped alongside

- A stray `<p className="leadership-note">` (the Ley→Taylor splice note) moved INTO the
  section's `HowTo` paras array as a JSX fragment (keeps `<strong>` runs) — the Leadership
  HowTo uses `label="How to read these charts"` + `cls="leadership-note"`.
- Removing a static `card-sub` is legitimate when a dynamic lead replaces its meaning —
  the head `<div>` then holds only the `h2.card-title`.
- pvLead's trailing Coalition clause joins with ", while the <house> has been left
  behind on N%" (73efb6a; the user changed their mind from "and" → "while" same-day —
  expect taste-level churn on these sentences' conjunctions and weight).

## Verification and shipping

Same drill as every asset change: build → validate → grep the BUILT index.html for the
compiled JSX (`className: "pv-lead"` — count 2 for a new render+CSS pair), diff
index.html to confirm ONLY your hunks moved, stage exactly the three files (template.html,
a11e1559 asset, index.html — `build.mjs` carries foreign WIP, never `git add -A`), commit
with separate `-m` flags, push, then live-verify after a standalone `sleep 95` (cURL
`grep -c 'pv-lead|ld-lead'` on the live page = 3 for two classes).
