---
name: auspol-fieldwork-pending-display
description: auspol-tracker — the fieldworkPending "TBC" display contract end-to-end (settled 2026-10-11, commits 74b11a0 Resolve wiring + 941f7da bare-TBC copy): polls.json flag → gen-data FIELD_TBC_URL/fieldUrl emission + validate excuse → rdFieldTxt/rdFieldTbc helpers in rd-allpolls.jsx → every surface shows bare "TBC" EXCEPT the Latest column of the latest-and-next table which keeps composite "fieldwork TBC" (user carve-out); tooltip titles conditional, detail meta band keeps label|value. Includes the full site census (copy lives in BOTH rd-*.jsx sources AND the three hashed .js asset INPUTS) and the doc mirrors that must stay truthful.
source: auto-skill
extracted_at: '2026-10-11T07:33:51.583Z'
---

# fieldworkPending → "TBC" display contract (worked 2026-10-11)

## The chain

1. `data/polls.json` row carries `fieldworkPending: true` — filed by
   extract-demosau (Capital Brief article before the methodology PDF) or
   `.build/assimilate-resolve-vi.mjs` at filing time (csv has no window;
   dropped by the hand-stamp/PDF match when real dates land).
2. `gen-data.mjs` `FIELD_TBC_URL` map (~:2910; DemosAU → methodology
   statements, Resolve → the SMH topic page) feeds §6 emission:
   `fieldPending: true, fieldUrl` on `individualPolls` (~:3020) and
   `pollsterTable` (~:3295). `validate.mjs`'s `fieldwork-pending` check
   excuses the provisional window and FAILS the flag on a row that already
   has its methodUrl.
3. Shared helpers in `.build/newtracker/assets/rd-allpolls.jsx` (~:166-183):
   - `rdFieldTxt(q)` — plain text: "TBC" when pending, else `field || dateLabel`.
   - `rdFieldTbc(p)` — the linked form (single arg since 941f7da; the
     `bare` prefix parameter is GONE). `<a className="rd-tbc" href={fieldUrl}>TBC</a>`
     when fieldUrl, else `<span title=…>TBC</span>`; both carry the
     "Fieldwork dates not yet published…" note title.

Final 941f7da call sites of `rdFieldTbc`: rdPollHead (same file), the
phone row cell rd-allpolls.jsx:2916, `a11e1559…js`:4215 and
`d1a1d215…js`:3925 (the detail meta band).

## The contract (user-settled in three messages)

- **Bare "TBC" everywhere** — masthead latest line, All-polls fieldwork
  column, feedback prefills, aria labels, panels dot tooltips. Linked TBC
  styling (`.rd-tbc`) unchanged.
- **ONE carve-out: the Latest column of the latest-and-next polls table
  keeps composite "fieldwork TBC"** — rd-polls.jsx:681 (desktop `.rd-pl-sub`
  cell) and :700 (phone `.rd-pl-foot1`). User: "i mean 'fieldwork TBC' in
  the latest column of the latest and next polls table is fine … but in the
  all polls 'fieldwork' column it is not fine".
- **Head sentence**: rdPollHead's pending branch reads
  `Conducted on dates {rdFieldTbc(p)} from …` — the probes
  `.matilda/probe/ledger.mjs` + `conf-byline.mjs` pin starts of
  "Conducted on"/"From ". copy-poll.js `retitlePollHead` has TBC-aware
  rules ("Conducted on dates " → `house (fieldwork dates `; " from " with
  `.rd-tbc` present → ", ") — any head-wording change must keep those anchors.
- **Tooltip titles are conditional**: the three chart-tip `tip-title`s in
  rd-allpolls.jsx (:497, :610, :943) and the latest-timeline tooltip
  (rd-polls.jsx:294) print "Fieldwork ‹window›" for a dated poll, bare
  "TBC" when pending (no bare-label form).
- **Detail meta band untouched**: label|value pair
  `<pd-meta-k>Fieldwork</pd-meta-k>` + `<pd-meta-v>{rdFieldTbc(…)}</pd-meta-v>`
  — matches the eff. TBC contract the user endorsed.

## The census technique (why greps missed half of it)

TBC copy lives in BOTH source classes that build.mjs transpiles (its JSX
array ~:110-121, re-transpiled per build):

- the `rd-*.jsx` sources (rd-allpolls.jsx, rd-polls.jsx, rd-panels.jsx), AND
- the **three hashed `.js` asset INPUTS** — `a11e1559`, `d1a1d215`, `73de0c58`
  — which are committed, hand-edited files (the masthead latest line exists
  ONLY in 73de0c58:374-378; the meta band callers only in a11e1559/d1a1d215).
  `grep` over `*.jsx` alone misses them; also grep `"Fieldwork {` for the
  label+value JSX combos that build the phrase at render.

Built-page verification: babel leaves ASCII string literals intact, so
`grep "fieldwork TBC" index.html allpolls/index.html …` is exact. Post-
941f7da invariant: **zero "Fieldwork TBC" (capital F) anywhere; exactly
two "fieldwork TBC" per tab document** (the two rd-pl sites).

## Doc mirrors that must stay truthful (updated in 941f7da)

MATILDA.md DemosAU LLM-readers bullet ("every visible fieldwork label
instead says TBC"), gen-data.mjs :3023 comment, extract-demosau.mjs :77-85
header (its line ~:77 quotes the user's 2026-10-05 "just say fieldwork TBC"
instruction — keep QUOTES verbatim, update only behavioural descriptions),
`.build/demosau-repair-prompt.md` :45, rd.css :458 comment. Do NOT edit
`.matilda/` copies (sibling-session territory).
