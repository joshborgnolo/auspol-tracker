---
name: auspol-allpolls-sortable-column
description: auspol-tracker — making an ALREADY-EXISTING but non-sortable column in the All-polls table sortable (header renders as a plain span/th while its neighbours are sortable). Worked TWICE 2026-10-07 (commits 3b215a6 primary-facet OTH, 7731218 direction-facet Unsure). A sortable column is wired in THREE homes — redesign hrow th() call, classic thead ArchSortTh, getVal sort-switch case — and the datum usually already exists on the archive row (the wide CSV export carries every measure). User asks for these as "also do X like the other columns" follow-ups.
source: auto-skill
extracted_at: '2026-10-07T03:25:14.275Z'
---

# Making an existing All-polls column sortable

Sibling of `auspol-allpolls-column-surgery` (which covers ADDING/REMOVING
columns — four homes, grid tracks, colCount chains). This one is the
cheaper job: the column already renders, it just isn't clickable. The
contract, twice-worked (OTH in primary → 3b215a6, Unsure in direction →
7731218):

## Clue & probe

Redesign hrow (`rd-allpolls.jsx`, the `{facet === "x" && <>…}` header
group): the target column is a **plain element** —
`<span className="rd-ap-th">Unsure</span>` — sitting between
`{th("Label", "key", …)}` calls. Grep `dir\.(right|wrong|net)`-style
keys to find the group, then LOOK at the lines between the `th(` hits —
the plain element is the gap (rd-allpolls.jsx:1906 / :1906-ish pattern).

## The three homes

1. **Redesign hrow** — swap the plain span for the shared helper:
   `{th("Unsure", "dir.unsure")}`. No colour opts unless the old span
   had one (OTH kept `style={{color}}`, Unsure was plain ink).
   Static-list siblings need no key; only `.map()`-generated groups
   (the primary facet's `prims.map`) wrap `th(...)` in
   `<React.Fragment key>`, and there the change is usually "stop
   special-casing one id" (the pre-3b215a6 code had an
   `k.id === "oth"` branch rendering a span).
2. **Classic thead** (d1a1d215 asset, per-facet `<>` group around
   :5912): `<th scope="col" className="hide-md">Unsure</th>` →
   `<ArchSortTh label="Unsure" k="dir.unsure" className="hide-md"
   sort={sort} onSort={onSort} />`. `ArchSortTh` = `window.SortTh`
   (defined in a11e1559 :3538) and its props are
   `{label, short, sortKey, k, sort, onSort, className}` — **className
   is first-class**, so carry the old th's responsive class (`hide-md`)
   onto the ArchSortTh. `short=` is optional (mobile abbreviation; OTH
   and Unsure need none).
3. **getVal sort switch** (d1a1d215, `case "dir.right":` group ~:5473):
   add the case beside its dir/primary siblings, same idiom:
   `case "dir.unsure": return p.dir ? p.dir.unsure : -Infinity;`.
   The existence-guard + `-Infinity` sink is the house pattern — rows
   lacking the measure sort to the bottom, descending-from-the-top.
   Descending-first on click is the switch/thead machinery's behaviour;
   you don't set it per column.

## The datum is almost always already there

Before wiring, confirm the value exists on the archive rows: the CSV
export builder in d1a1d215 (~:5600) emits a WIDE sheet for every facet —
`["Direction unsure", (p) => (p.dir ? p.dir.unsure : "")]` — and the
classic row `<td>` already renders it. If it's in the CSV export, the
sort case just reads the same field (`p.p.oth`, `p.dir.unsure`). No
gen-data change needed; no URL-state whitelist exists (sort keys ride
`?s=` as free strings).

## Verify & ship

Rebuild + validate clean; `git diff HEAD -- index.html` must show ONLY
your hunks (clean-artifact-commit recipe if the tree has sibling WIP —
shelve their modified build inputs by path first). The built file's diff
shows exactly three hunks: the th() swap and the ArchSortTh swap and the
switch case (the phone pinned-header caption e.g. "Right direction,
unsure, wrong track, %" is a different element — leave it). Column ORDER
never changes — `Rd_AP_PRIM_FALLBACK` / `primaryOrder` walk untouched.

## Also covered that run

- Commit landed 3ccb8eb, push raced by a CI/sibling data commit
  (3053d7b, own index.html regen), rebase replayed cleanly, fresh rebuild
  was **byte-identical** to HEAD (the textual-replay proof from
  clean-artifact-commit's field notes) → pushed as 7731218.
- A sibling dirtied two MORE SKILL.md files mid-rebase attempt;
  `git rebase --autostash` rides over unstaged-dirt refusals.
- ArchSortTh's definition: `const ArchSortTh = window.SortTh;` at
  d1a1d215:3371 — grep `function SortTh` in a11e1559, not `ArchSortTh`
  in d1a1d215.
