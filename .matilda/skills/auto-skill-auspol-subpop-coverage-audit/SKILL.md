---
name: auspol-subpop-coverage-audit
description: auspol-tracker — triaging "is there enough data to add subpopulation X to the primary chart view" (worked 2026-10-10). Disambiguation (primary chart view = the Snapshot Primary vote panel's group dropdown, 8 optgroups/27 groups), the dropdown's pooling bar from demo-groups.mjs, the per-dim coverage-inventory recipe (incl. the truncation trap that hides state/religion/softness/working), and the dated verdict table for every extra dim in demographics.json: working=YES, income=binary-$100k-only revisit, religion/finer-age/children/class/country-of-birth/electorate verdicts with exact house series spans.
source: auto-skill
extracted_at: '2026-10-10T04:17:16.045Z'
---

# Triaging "enough data for another subpopulation in the primary chart view"

User question shape (2026-10-10): "Is there enough data to add any other
subpopulations to the primary chart view?" Deliverable is an EVIDENCED VERDICT
per dim, not a data edit — never start wiring a new set without an explicit
nod. Fully worked in this session; re-verify counts before re-answering (waves
land fortnightly/quarterly, and YouGov/RedBridge label changes are live risks).

## Disambiguate first: the "primary chart view" is a specific machine

The Snapshot **Primary vote panel** (`#primary-vote`) has an "All voters"
<select> at the dek's right edge. Its group inventory is:

- 8 optgroups = the 8 `DEMO_SETS` in `.build/newtracker/demo-groups.mjs`
  (By age, By generation, Gender, Education, By state, By location, By
  housing, By language at home), 27 groups total, + All voters = 28 options —
  PINNED by `.matilda/probe/pv-group-select.mjs` ("28 options", "8
  optgroups"). Its assertions name "All voters + 27 groups".
- A new subpopulation means a NEW `DEMO_SETS` entry (+ its `DEMO_SHARE`
  census-share row for the error floors, + `harmonize()` label mapping, +
  probe updates). Groups whose dim has no election baseline get "since
  <first polled month>" sub-lines — the machinery already handles that
  (generations have no election row either).

A candidate group must clear the panel's pooling contract (the "same people"
rule documented at the top of demo-groups.mjs):

1. **≥2 houses cut the SAME group, label-reconcilable** — single-house cuts
   stay in the All-polls Demographics facet ("Other cuts" tables) forever.
2. **A recurring, STILL-LIVE series** — trend + pooled figure both need it.
   Wave COUNT is not enough; check each house's LAST wave date.
3. **No estimates** — weighted merges are allowed ONLY from printed group
   sizes (precedents: RedBridge school rows merge 39:61 on its own printed
   group sizes; YouGov's SA/WA/(ACT/NT/Tas) merge to Non-NSW/Vic/Qld on 2025
   AEC formal-vote shares).
4. `DEMO_SHARE` population shares must be derivable (census etc.) for the
   sampling-error floors.

## The coverage-inventory recipe

Per (dim, group): which houses print it, wave count, first..last. Run:

```sh
python3 - <<'EOF'
import json, collections
d = json.load(open('data/demographics.json'))
bydim = collections.defaultdict(lambda: collections.defaultdict(set))
dates = collections.defaultdict(set)
for w in d['waves']:
    for dim, groups in (w.get('dims') or {}).items():
        for g in groups:
            bydim[dim][g].add(w['pollster']); dates[(dim,g)].add((w['date'],w['pollster']))
for dim in sorted(bydim):
    print(f"-- {dim} --")
    for g in sorted(bydim[dim]):
        dts = sorted(x[0] for x in dates[(dim,g)])
        print(f"  {g}  {sorted(bydim[dim][g])}  n={len(dates[(dim,g)])}  {dts[0]}..{dts[-1]}")
EOF
```

Then per candidate group print PER-HOUSE first..last + n (the session's third
script) — that is where live-vs-dead resolves.

**Output-truncation trap (bit this session):** a long sorted print was cut
after "-- occupation --" with no warning and exit 0 — `state` (50 waves!),
`religion`, `softness`, `stress`, `working` all sort after it and vanished.
A dim "missing" from such a dump is NOT absent. Print the dim-key counter
first (`collections.Counter` of keys across waves) and diff against the dump.

## Verdict table as of 2026-10-10 (from data/demographics.json, 101 waves)

| dim / groups | houses (series) | verdict |
|---|---|---|
| **working** — Full time/Part time/Retired; "Other" residual | YouGov fortnightly 2026-06-02→10-06 n=9 (prints ONLY the 3 rows, no residual); Newspoll (pooled) quarterly 2025-09-11→09-18 n=5, same 3 labels + "Other" | **YES — the one ready dim.** Exact-label match, no merges. "Other/Not working" group stays Newspoll-only (YouGov prints none; RedBridge's Oct-2025 one-off sheet had it) — offer 3 groups or accept a sparse 4th rows. |
| **income** | YouGov was 4-bracket ($50k/$100k/$150k) Jan–Feb 2026, **switched to binary "Under $100k"/"$100k or more" from 2026-04-07** (n=13 live); Newspoll pooled prints the 4 brackets every quarter (n=5 live); DemosAU/Resolve/Freshwater/RedBridge brackets all clash | **Binary-$100k revisit only.** YouGov-binary == Newspoll merged (Under50+50–99 vs 100–149+150+); the 2026-10-07 four-bracket "irreconcilable" ruling stays true for DemosAU. Under-$50k alone is worse (YouGov's binary crosses nothing else). User decision, not a new fact to override silently. |
| **religion** — Christian/No religion (+RB Catholic/Protestant split) | Newspoll pooled n=5 live; RedBridge one wave 2025-10-07 | **No** — one live house. Watch: if RedBridge's detail sheet recurs or YouGov starts, merge Catholic+Protestant at printed group sizes. |
| **finer age 35–49 / 50–64 / 65+** | 35–49: YouGov live fortnightly n=14, Newspoll pooled n=5, Roy Morgan n=9 (2025-11→2026-05-10, machine era reads state/city-country only — age packs ENDED), Fox&Hedgehog n=4, RB/MRP one-offs. 50–64, 65+: **YouGov exited 2026-03-19** (switched to 50+) taking the only fortnightly feed; forward = Newspoll quarterly + F&H alone | **Strong retrospective, cooling forward.** As a second ("finer") age axis each band would be pooled from 1–2 live houses going forward. Axed by the live-series rule unless the user accepts slow series. |
| **children** — No children / under 18 / 18+ | YouGov only, n=14 live | No — single house. |
| **class** — Working/Middle/Well off; **softness** — Solid/Soft/Very soft | YouGov only n=14 live; RedBridge only n=9 live | No — single house each (softness is also decidedness-flavoured, not a subpopulation). |
| **country of birth** | Roy Morgan (pooled) 2026-07-31 one wave (13 groups); RedBridge Australia/Another country n=5, last printed 2026-03-19 | **No — dead series.** RM's one mega-wave + RB's stopped rows never form a live 2-house series. |
| **location detail** — City/Country, Reg-or-rural, Tas/NT/ACT, ACT-NT-Tas | RM Capital Cities/Regional-Rural Areas n=1 (machine era just began); DemosAU "Regional or rural" n=9 live but joins nothing (REGULAR location cuts live: YouGov+RedBridge fortnightly/monthly 4-way); Tas/NT/ACT only DemosAU-MRP n=2, ended Mar 2026 | Not enough as NEW dims; the existing 4-way location set already serves the city-v-country story. |
| **electorate** (Tas seats) / **occupation** / **stress** | EMRS n=1; RedBridge 2025-10-07 one wave each | No — one-offs, single house. |
| **generation: Silent** | YouGov only n=14 live (RedBridge prints no Silent row) | No — single house. |

## Adjacent facts pinned this session

- `DEMO_SETS` grouping rule text (top comment of demo-groups.mjs) IS the
  contract source; `harmonize()`'s devoted-out comments ("DemosAU's Regional
  or rural finds no key here") record WHY near-miss label cuts are excluded —
  read them before proposing any merge.
- Newspoll (pooled)'s quarterly dim roster beyond the common sets: education
  (No tertiary/TAFE/University), working (4 rows), income (4 brackets),
  religion (Christian/No religion), generation 5-level as 35–49/50–64/65+ —
  printed in its pooled tables PDF every quarter, all currently
  facet-only/underused.
- The All-polls Demographics facet (`?f=d`) is THE HOME for everything that
  fails the dropdown bar: it carries per-poll cuts facet-only ("Other cuts"
  tables), including YouGov's children/class/working, RM's birth-country
  mega-wave, EMRS electorates. A "no" for the dropdown is rarely "the data
  is invisible".
- Freshwater/Fox & Hedgehog print idiosyncratic age bands (18–35/36–53/54+;
  18–34…Other States/Terr.) — they can't harmonise anywhere; facet-only.

## Related

- auto-skill-auspol-demographics-reader (the pipeline, gates, KNOWN_SKIP/
  KNOWN_DROP and the same-people mapping rules).
- auto-skill-auspol-allpolls-demographics-split (shipping a facet SPLIT — the
  OTHER consumer — across its eight homes).
- auto-skill-auspol-allpolls-facet-candidate (facet-level "should X become a
  facet" adjudications).
- auto-skill-auspol-wiki-subpop-audit (what external sources carry vs the
  data; verified gap-wave list).
