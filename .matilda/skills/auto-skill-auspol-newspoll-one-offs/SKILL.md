---
name: auspol-newspoll-one-offs
description: auspol-tracker — building/maintaining data/newspoll-one-offs.json, the THIRD one-off-question store (worked 2026-10-17, commit d3cfa808 — 18 entries over 10 of 19 Newspoll waves 2025-26; +2 2026-10-25, the 2025-10-30 immigration pair from secondary coverage — 20 entries, 11 waves). Unlike News24 (fetchWithCookies) and RedBridge (committed PDF caches), Newspoll has NO committed corpus — the corpus is The Australian via .build/chrome-article.mjs into the cached .matilda/np-questions/dump-*.json kit. Newspoll Infogram embeds are uuid infogram-embed data-id markers (extract-newspoll.mjs:758), most stories embed only the LIVE "Federal Newspoll Regular" project; unlabelled historical trait charts labelled by their final-row anchor pair; topic-page sweep needs [?#].* stripped for wave de-dupe + recovers specials (immigration f0cdd659); a special gone from the topic page files from syndicated coverage with wordingSource 'secondary-coverage' + a retrospective cross-check gate; channelled-vs-one-off proved from data (approval[19]/ppm[19]/ppmHeadToHead[3]); parity check must whitelist the special-URL entries.
source: auto-skill
extracted_at: '2026-10-17T00:25:22.623Z'
---

# Newspoll one-offs store (data/newspoll-one-offs.json)

Use when extending/QC-ing the Newspoll sibling of the News24/RedBridge
one-off-question catalogues — the non-standing-battery questions The
Australian's wave stories disclose. Built 2026-10-17 (commit d3cfa808,
pushed): 18 entries, 10 of the 19 `pollster==="Newspoll"` waves; the other
nine waves were battery-only (three of them — 2025-08-14, 2025-09-11,
2026-02-26 — exist only in secondary coverage: thenewdaily, thenightly,
pollbludger — noted in the doc `sources` string). +2 2026-10-25: the
2025-10-30 wave's immigration special recovered from syndicated coverage
(20 entries, 11 waves — see "secondary-coverage special" below). Follows
the n24 builder shape — read `auspol-news24-question-audit` for the shared
builder/scoring conventions; this file records the Newspoll-specific
deltas.

## Corpus kit (`.matilda/np-questions/`, scratch — stays uncommitted like the n24 kit)

- `fetch-all.mjs` mirrors `.matilda/n24-questions/fetch-all.mjs` but the
  article text comes from **`.build/chrome-article.mjs`** (user's logged-in
  Chrome; News Corp walls fetchWithCookies here), called via
  `execFileSync("node", [".build/chrome-article.mjs", url],
  {cwd: root, timeout:60000, maxBuffer:64<<20})` — exit 0 = HTML, exit 1 =
  failure; reject the page if `/nocookies|check_cookie/i` hits the first
  2 kB. Per-wave `dump-<date>.json` cache; errored dumps are retried on
  re-run, clean ones kept.
- **Newspoll Infogram markers are UUIDs**, not News24's `_/` ids:
  `infogram-embed[^>]*?data-id="([0-9a-f-]{36})"` (same regex as
  extract-newspoll.mjs:758); lower-case + de-dupe. Each embed fetched
  anonymously via `IG_EMBED(id)` + `infographicDataOf`; `textsOf` walks the
  DraftJS `text` leaves, `chartEntitiesOf` pulls chart sheets.
- **Most wave stories only embed the LIVE project**
  `4a8c5dd6-38b0-4b34-ad88-20cbef869020` ("Federal Newspoll Regular") —
  battery captions only, no one-off data. Genuine one-off embeds that did
  show: 2026-01-16 `ab441d18…` word-association (2 leader tables) + three
  `Character-Traits-Graphic-{1,2,3}` (9 historical trait series);
  2026-07-16/08-07/08-28 `8b461452-4d45-46fc-8d8f-d1c761a4932e`
  ("TAD-2383 Newspoll Day 2" — Hanson sat / 3-way rank / distributed PM,
  all channelled, excluded); 2026-09-17 `4700c283…` "TAD-2641 PM
  popularity" (editorial context chart, excluded).
- **Topic-page sweep for standalone specials**: fetch TOPIC
  (`…/topics/newspoll?eafs_enabled=false`) via fetchWithCookies, Chrome
  fallback; tile regex + extract-newspoll.mjs's EXCLUDE (state polls etc.).
  **Strip `[?#].*` off every URL before de-duping against the wave set** —
  the 2026-03-26 polls.json row carries `?amp` and would never match a
  tile URL. Recovered exactly one special: `f0cdd659…` immigration story
  dumped as `dump-special-f0cdd659.json`, dated to the 2026-09-17 wave
  (sample 1244 matches).
- `review.mjs` regenerates the human-readable `review.txt` walk-through
  from the dumps.

## The builder (`.matilda/np-questions/build-one-offs.mjs`)

n24-shaped: each entry declares fail-loud `embed:`/`prose:` anchors, the
builder THROWS on a miss (never loosen to pass), re-anchor from the dump.
Entry shape `{id, waveDate, fieldwork:{start,end}, sample, published,
question, questionWordingSource, responseOptions, articleUrl, note?,
embed?, data:{tables,prose}}`; optional `dumpFile`+`articleUrl` override
loads the special story's dump instead of the wave's (load-time knob —
NOT written to the JSON).

- **Chart labelling by final-row match** (`traitTables()`): the three
  Character-Traits graphics are nine UNLABELLED historical series. Assert
  the matchup chart's totals first (PM-Experienced=69 / OL=44), then label
  each history chart by its final (PM agree, OL agree) pair; throw on
  ambiguity. Matched all 9 on first build.
- **News Corp prose spells numerals as words** ("two-thirds") — anchor
  on words, never on `/66 per cent/`-style numeral regexes.
- Known source anomaly kept verbatim + noted: The Australian's own
  Decisive-and-strong series mislabels a "Ms Ley" cell in its 2–6 Dec 2024
  row (Infogram transcription error upstream).

## Channelled-vs-one-off adjudication (verified from data, not memory)

- `approval[]` 19 Newspoll rows, `ppm[]` 19, `ppmHeadToHead[]` 3 (incl.
  the forced Albanese-v-Hanson distributed pairing) already in polls.json
  → all excluded. Newspoll is ABSENT from `data/vote-switching.json` → the
  2026-09-17 vote-recall analysis IS a genuine one-off (kept).

## Verification (run before commit)

Parity check `.matilda/np-questions/parity-check.mjs` against polls.json —
waveDate/fieldwork/sample/published parity for ALL entries; articleUrl
equals the row `url` EXCEPT a named SPECIAL set (waveDate+id → expected
URL): the 2026-09-17 immigration pair carries the special's news-story hex
(`f0cdd659809e04b5c313fca661f0a5c0`), the 2025-10-30 pair carries the
Daily Mail syndication URL. A whitelist key with no store entry is itself
a failure. The first draft of the check asserted url parity universally
and tripped on the specials — the whitelist is part of the check, not a
fudge. Plus: `node -e` JSON parse; `node .build/newtracker/validate.mjs`
must stay green (the store is a research product the validator doesn't
read, but rule 2 still applies to any commit touching data/). Commit ONLY
`data/newspoll-one-offs.json` — sibling sessions leave ~50 paths dirty;
stage the single path (use `git commit -F msgfile`, not an inline
heredoc — apostrophes in "Australian's" broke bash quoting once here).

## The secondary-coverage special (2026-10-25, the 2025-10-30 immigration pair)

A midweek special whose story has left the topic page is NOT lost: the
27–30 Oct 2025 wave's immigration special (64 fewer / 26 same / 7+3 more,
n=1265) is recoverable from syndicated coverage (Daily Mail Australia,
3 Nov 2025) when (a) the wave row in polls.json corroborates the sample
and timing and (b) The Australian's own LATER retrospective quotes the
identical toplines — the Sep-2026 f0cdd659 story's "The 2025 Newspoll
immigration questions showed 64 … 10 … 26" line is exactly that. File
such entries with `questionWordingSource: "secondary-coverage"`, the
syndication URL as articleUrl, and a builder gate that re-reads the
retrospective's figures from its committed dump and throws unless the
new entry's table matches (the gate lives after the new entries in
build-one-offs.mjs; corpus `dump-special-2025immigration.json`, fetcher
`fetch-2025-immigration-dump.mjs`). Same-store correction landed with
it: the 2026 pair's note previously said the Oct-2025 read was "outside
this corpus" — it no longer is. Wayback CDX on theaustralian.com.au
topic-page URLs returned empty; The Australian's original midweek story
URL is unrecoverable.

## Related

- `auspol-news24-question-audit` — the YouGov sibling + shared builder shape.
- `auspol-redbridge-one-offs` — the RedBridge sibling (committed-PDF corpus).
- `newspoll-extraction`, `chrome-session-piggyback` — the deterministic
  pipeline and the Chrome-read path this kit borrows.
