---
name: auspol-rss-feed
description: auspol-tracker — the feed.xml generator (build.mjs "5b" block ~:876-1010, expanded 2026-10-02 commit 8ea4613 to carry EVERY measure per wave, not just primary/2PP/sample). One item per `${house}|${date}` release wave merges TEN sources (polls/approval/ppm/ppmHeadToHead/altTpp/direction from polls.json; salience+ownership from issues.json; demographics.json; vote-switching.json) via the waveOf Map helper — watch the mixed key names (.pollster vs .firm). Direction-only and issues-only waves get their own items and a fallback title-head chain. No test pins feed content — verify with measure-sentence greps. Commit footprint is build.mjs + feed.xml only.
source: auto-skill
extracted_at: '2026-10-02T07:46:29.637Z'
---

# auspol-tracker RSS feed (feed.xml)

User request 2026-10-02: "i want all the data the site uses, in there" — the feed had
carried only primary/2PP/sample per item; it now stacks every measure the tracker holds
into a single item per release wave. Shipped as `8ea4613`.

## Where it lives / architecture

`.build/newtracker/build.mjs`, the "---- 5b. feed.xml" section (~lines 876–1010 after
`8ea4613`), run on every build. feed.xml is a committed generated file; a feed-only
edit changes **build.mjs + feed.xml** — `index.html` comes out of the rebuild
byte-identical (the feed isn't inlined into the page), so don't expect it in the diff.

Core pattern — **one item per wave**, not per measure:

```js
const waves = new Map(); // `${house}|${date}` -> every measure on record for the wave
const waveOf = (house, date, dateStart) => { ... };
for (const p of DATA.polls) if (!p.isElection) waveOf(p.pollster, p.date, p.dateStart).poll = p;
for (const a of DATA.approval || []) waveOf(a.firm, a.date).approval = a;
// … ppm / ppmHeadToHead / altTpp use .firm too …
for (const d of DATA.direction || []) waveOf(d.pollster, d.date, ...).dir = d;
for (const s of ISSUES.salience || []) waveOf(s.pollster, ...).sal = s;   // data/issues.json
for (const o of ISSUES.ownership || []) waveOf(o.pollster, ...).own = o; // data/issues.json
for (const g of DEMO.waves || []) waveOf(g.pollster, ...).demo = g;      // data/demographics.json
for (const v of SWITCH.waves || []) waveOf(v.pollster, ...).sw = v;      // data/vote-switching.json
```

gotchas:

- **Key names differ by array**: `polls[]`, `direction[]`, and all three sidecar json
  files key the house as `.pollster`; polls.json's `approval` / `ppm` / `ppmHeadToHead`
  / `altTpp` rows use `.firm`. Copy-paste between the merge loops for them silently
  keys waves as `undefined|<date>` — one merged item swallowing every house.
- `isElection` rows are excluded from feed waves deliberately.
- `waveOf` backfills `dateStart` when a later source carries it (direction rows, the
  issues sidecars) and the VI row didn't supply one.
- build.mjs reads `data/{issues,demographics,vote-switching}.json` directly via
  `fs.readFileSync` — they are NOT part of DATA (the gen-data grab() set).

Per wave the description stacks labelled sentences in a fixed order: Primary vote →
Two-party preferred (explicit "No two-party figure published." when absent) → Three-way
(`p.tpp3`) → Undecided → Soft vote (+`softAge` breakdown) → Other two-party contests
(`altTpp` as ALP–ON / LNP–ON lines) → Preferred PM (appends "– Hanson N" when the ppm
row's `han` is set: three-way question; before 3cd7fb1 the line dropped it, so RedBridge
Oct 2026 read "Albanese 31 – Taylor 15" and the user blamed the filing agent - the row was
right) → Albanese-v-Hanson head-to-head →
Satisfaction (net + approve/disapprove from `approval.detail`) → National direction →
The issues (salience per issue code-labelled via `ISSUES.issues`, top3 and r1 shares) →
best party on each (ownership shares, `equal`/`none`/`unsure` map) → The vote by group
(per-dimension breakdowns) → Where the 2025 vote has moved → Sample (first non-null
across poll→sal→own→demo→sw) → Fieldwork.

## Non-VI waves get items of their own

SEC Newgate's direction-only releases and Ipsos's Issues Monitor (in salience but never
polls[]) now appear — that was the point of the wave key living across sources. Title
head falls back: `2PP ALP N – L/NP N` → `shareLine(p)` → `Right N · Wrong track N` →
`the issues` → `vote switching` → `the vote by group` → `polling release`. Item `<link>`
picks the pollster's own URL from whichever datum exists, in order:
`p.url → dir.url → sal.source → own.source → demo.article||source → sw.article||source
→ SITE_URL`. Wave window: last 40 by date desc (tie: house name asc).

Other mechanics: guid `auspol-tracker:<date>|<house>`; pubDate is `w.date + "T12:00:00Z"`
— a date-only fieldwork end at midnight UTC lands west-of-Greenwich readers on the
previous day (in-source comment); the channel `<description>` was restated to cover the
widened payload; build log line is `built feed.xml · N waves, newest <date> <house>`.

## Verifying a feed change

**No test pins feed content.** `test-site-check.mjs`'s "feed-mismatch" scenario is a
serving test, not a content one; site-config.yml's feed health check is existence-only.
After editing, verify by hand in the regenerated `feed.xml`:

- `grep -c "<item>"` == `grep -c "</item>"` (40 as of 8ea4613);
- `grep -c "&"` sanity — all ampersands must be `&amp;`-escaped (`xesc` does it; bare `&`
  in a title/URL is a bug);
- one grep per measure sentence stem ("Primary vote:", "Satisfaction:",
  "National direction:", "The issues, what voters say matters:", "The vote by group (",
  "Where the 2025 vote has moved:", …) to confirm each class is present in plausible
  counts;
- for a spot-check item, confirm the `<link>` is the pollster's own URL, not SITE_URL.

## Safe-staging note (shared repo)

Feed work moves exactly `build.mjs` + `feed.xml`; stage those two by name. During
`8ea4613` the same checkout held ~12 unrelated `.matilda/*` probe files from a sibling/
prior session — they must NOT ride along (see git-prestaged-commit-sweep). Long commit
messages go through a message file (`cat > .git/COMMIT_EDITMSG_MATILDA.txt <<'EOF' …
EOF; git commit -F …; rm …`) per build-pipeline rule 7. Push is plain
`git push origin HEAD:main` — `.build/git-push-main.sh` is a sourceable library that
exits 0 doing nothing when executed directly (see ci-main-writer-races).
