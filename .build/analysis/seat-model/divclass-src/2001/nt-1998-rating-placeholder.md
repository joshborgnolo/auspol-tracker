# Northern Territory — 1998-era demographic rating: **RESOLVED — Rural**

CORROBORATED 2026-10-22 (second update): the AEC's own 1998 "Divisional
Classifications" page was recovered from Wayback
(`aec.gov.au/Elections/federal_elections/1998/classification.htm`, capture
20070831140251) and carries `Northern Territory, NT, 105 048, Rural,
Marginal, ALP` — the same rating, independently printed. Both the 1996 and
1998 tables are now LANDED as canonical blocks elections["1996"] /
elections["1998"] in data/division-classifications.json (committed
fixtures `.build/analysis/seat-model/aec-1996/aec-1998-epoch-classifications.tsv`,
offline lanes in the extractor, pins in the test). Note the 1996→1998
division set is NOT identical as first estimated below: the 1997
redistribution removed Namadgi (ACT 3→2) and created Blair (Qld 26→27).

UPDATE 2026-10-22 (supersedes the placeholder below): the AEC's own
"Classification of Divisions following the 1996 Federal Election" page was
recovered from Wayback (`aec.gov.au/_content/When/elections/1996/info/
classification.htm`, capture 20060524142147) and carries the NT row:

    Northern Territory, NT, 98800, Rural, Marginal, CLP

The 1996 division set == the 1998-election division set (148 rows,
Namadgi present, ACT 3 seats, single NT seat), so this IS the 1998-epoch
answer. All three guesses were wrong — the placeholder's "Provincial"
inference, and Wikipedia's "Provincial, rural and remote" composite.
Landing path: elections["1996"] block via the extractor's offline-fixture
lane (parsed table cached at .build/analysis/seat-model/divclass-src/1996/1996-classification.tsv).

--- original placeholder note, kept for the trail ---

# Northern Territory — 1998-era demographic rating: PLACEHOLDER

Assumption (recorded 2026-10-22, user call, non-canonical):

    Division of Northern Territory (1998 frame, single undivided seat) → **Provincial**

Status: placeholder estimate, NOT an AEC reading. Do not promote into
`aec-2001-epoch-profile-ratings.tsv` or `data/division-classifications.json`
without a sighted source row — the committed layer is keyed to the 2001
division set (NT abolished Dec 2000 redistribution), is provenance-typed
(aecPage | rr5Patch only) and count/distribution-pinned.

Basis for the assumption (all inherited/derived, none primary):
- AEC definition: Provincial = "outside capital cities, majority of
  enrolment in major provincial cities" — the undivided NT majority-wide
  enrolment sat in Darwin (a major provincial city, not a state capital).
- Wikipedia's `Division of Northern Territory` infobox says
  "Provincial, rural and remote" — editor-authored composite (no citation;
  template accepts free text; cf. Wikipedia's Lingiari "Rural and remote"
  vs AEC's plain "Rural"). NOT citable itself, but encodes the same
  structural judgement.
- Analogy: post-split Solomon is AEC Inner Metropolitan (urban Darwin),
  Lingiari Rural — the pre-split seat covered both; a single label had to
  weight Darwin's majority.

Upgrade path (replaces this placeholder):
- NBAC item `AU NBAC N436-147` — National Electoral Division Profiles,
  June 1996 binder, 148 divisions (1996/1998 share the same division set;
  NT included). Physical access: reading room, Menzies Library, ANU Acton;
  email archives@anu.edu.au first, quote the reference; photograph the NT
  page (no photocopy service; own camera allowed).
- The June 1996 division set == the 1998-election division set, so any
  ratings table in that binder is exactly the 1998-epoch layer for all 148
  (and could upgrade this file into a full 1998 canonical block).

Ruled out so far for NT 1998:
- Wayback: profile page never archived (CDX 1998–2004, alias variants).
- RR5 `research_paper5.pdf`: keyed to the 2001 division set (NT absent).
- 1998 election statistics zip: results/funding/menu docs, no class table.
- RP7 (`research_paper7.pdf`): 2004-election frame (solomon/lingiari era).
- `mackerras-2000.html`: no NT classification mention.
