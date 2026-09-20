---
name: auspol-tpp-pair-labelling
description: auspol-tracker — the 2025-flows 2PP pair renders as a FULL contest line spliced straight after the canonical pair via tppLines(cs,r) in a11e1559 (never a compact tail after the alt matchups); both lines get matchup prefixes + basis notes, the "respondent-allocated" note is keyed on contest kind + !derived — NEVER array index, because 3-cornered waves inject a DERIVED pair into tppContests. Since 2026-09-20 (after c004ce4's run-in labels were reverted in 1b964de) the page's COMPUTED implied re-reads live in their OWN "Implied 2PP" PdSec built by impliedLines(r) — tppLines(cs,r) holds only what the house printed — and PollLedger is window-exported so a11e1559 edits cover BOTH detail views.
source: auto-skill
extracted_at: '2026-08-31T07:41:32.853Z'
---

# Two-pair 2PP labelling in the expanded poll view (auspol-tracker)

Shipped 2026-08-31 across three commits: `9f316a9` (pair labels), `9fea364` (RedBridge
flows data), `dadf71d` (flows pair promoted from compact tail to a full adjacent line).

> Update 2026-09-20: `PollLedger` (the whole ledger body — `tppLines`, `TppLine`, the
> TPP `PdSec`) is now single-home in a11e1559 and window-exported; the archive's
> d1a1d215 renders it via `window.PollLedger` (no duplicate renderer). One edit to
> a11e1559 covers BOTH Latest and All-polls detail views. (The earlier claim that the
> archive has no flows line predates the PollLedger share.)

## Where

- `tppLines(cs, r)` — a11e1559 (~line 1496, right after `tppHeading`). Builds the detail
  section's line list from the `tppContests` output: canonical/alt contests pass through,
  notes are attached (`"respondent-allocated"` on the canonical pair when `r.tppFlows`
  exists), and the 2025-flows pair is SPLICED IN as a full contest straight after the
  canonical pair (ahead of the alt matchups). Each returned entry carries `count` (the
  list length) so `prefixed` includes the flows line.
- Call site — the TPP `PdSec` in `PollLedger` (a11e1559 ~line 1924):

```jsx
{tppLines(tcs, r).map((x, i) => <TppLine key={"t" + i} c={x.c} prefixed={x.count > 1} note={x.note} />)}
```

- `TppLine` — (~line 1852), one preference contest per line. Renders `note` AFTER the
  segments: `{note && <span className="pd-s-note"> ({note})</span>}`. Strips the
  `"2PP · "` prefix off `c.lab` for its rendered matchup prefix — the flows contest
  reuses `lab: "2PP · ALP v L/NP"` so both lines prefix identically as `ALP v L/NP:`
  and are disambiguated only by their trailing notes.

## The flows pair is a full line, NOT a compact tail (revision dadf71d)

The original pair-labelling build (9f316a9/9fea364) left the flows pair as a compact
`<p className="pd-s">52% ALP vs 48% L/NP (2025 preference flows) <chg>` emitted AFTER
the `tcs.map` — i.e. UNDER the ALP-v-ON alt matchups. User feedback: "in a weird order…
should just be ALP vs L/NP: 52%… (ie in same format)". The flows pair is the same
question as the canonical pair on a different basis, so it belongs adjacent to it, in
the canonical format. The fix (commit `dadf71d`):

```js
const canonical = c.kind === "2pp" && !c.derived && r.tppFlows != null;
// after pushing the canonical line, splice:
out.push({ note: (
  <>2025-election{" "}
    <button type="button" className="hi-term"
            onClick={() => window.AP.openTerm &&
              window.AP.openTerm("preference-flows", "poll breakdown")}>preference flows</button></>
), c: {
  kind: "flows", lab: "2PP · ALP v L/NP", flag: null,
  segs: [
    { label: "ALP", value: r.tppFlows, color: PARTY_C.alp, delta: dFlows },
    { label: "L/NP", value: Math.round((100 - r.tppFlows) * 10) / 10, color: PARTY_C.lnp,
                      delta: dFlows ? { v: +(-dFlows.v).toFixed(1), refDate: dFlows.refDate } : null },
  ] } });
```

- The note is JSX since the 1 Sep 2026 link-out: the trailing words "preference flows"
  are a glossary deep-link (`openTerm("preference-flows", "poll breakdown")`, the same
  tap-to-define `hi-term` treatment as the hero note) — TppLine wraps it so the line
  reads "(2025-election preference flows)".

- `dFlows = segDelta(r.chg, "flows")`; the L/NP side gets the NEGATED delta (mirrored),
  exactly how the canonical pair mirrors `alp2pp`. Each side renders its own ChgParen.
- SPLICE LOCATION: inside `tppLines`, NOT inside `tppContests` — the contests function
  also feeds `tppFlag` (compact-row facet flags) and compact-row headline bars; keep it
  pure. `tppHeading(tcs)` deliberately still reads the UNSPLICED `tcs`, so a row whose
  only contests are canonical+flows keeps its "Two-party preferred" heading while both
  lines show matchup prefixes.
- A single 2PP pair (no flows) gets no label AND no prefix — `x.count > 1` governs.

## The trap: key the note by contest kind, NOT array index

`tppContests(r)` (a11e1559 ~1440) builds the contest list dynamically: a 3-cornered
wave emits its 3cp contest FIRST and then a derived "2PP · ALP v L/NP · Derived" pair,
pushing positions down. A first attempt keyed "respondent-allocated" on `i === 0` and
would have mislabelled those waves. The correct predicate (now inside `tppLines`) is:

`c.kind === "2pp" && !c.derived && r.tppFlows != null`

- A single 2PP pair (no flows data) gets NO label — nothing to disambiguate.
- A derived pair is NEVER the respondent-allocated one.

## Which rows have both pairs

- Roy Morgan — every row (canonical pair = respondent-allocated; `tpp_flows` = the
  2025-election-flows ALP share).
- "RedBridge/Accent" — since the 2026-08-31 convention reversal: Apr 53, May 52,
  Jun 55, Jul 50 (extractor commits from the Accent PDF `tppHist` column), Aug 52
  (hand-entered — that manual-ingest wave is invisible to extractor discovery; see
  the redbridge-accent-extraction skill's *Discovery gap* section).

## Published vs implied: two sections (2026-09-20, supersedes c004ce4)

User feedback on the five-line "After preferences" list ("this is messy —
respondent-allocated + implied 2pp displayed without any delimitation"). First
attempt c004ce4 kept ONE `PdSec` with `.pd-s-grp` run-in labels ("Published" /
"implied 2PP") and was reverted nine minutes later (1b964de, no reason given).
The user then chose the SPLIT when offered three options (two sections /
restore the run-in labels / mute the implied lines):

- `tppLines(cs, r)` now returns ONLY what the house printed: the tppContests
  output plus the spliced `alt` house-figure line ("or … under 2025-election
  preference flows"). No `grp` tags, no implied entries.
- `impliedLines(r)` (new, right after tppLines) returns the computed classic
  (`r.alpImp`, delta "imp" falling back to "flows") then the ON re-read
  (`r.alpOnImp`, delta "impOn"), each with `count` for the prefix rule. Notes
  name ONLY the flow basis (`under 2025-election preference flows` /
  `under the first-principles flow set`).
- PollLedger: the After-preferences `PdSec` maps `tppLines` and relies on
  PdSec's own "Not published" fallback (the explicit `!tcs.length` line is
  gone). A second `<PdSec label={<button className="hi-term" …
  openTerm("implied-2pp", "poll breakdown")>Implied 2PP</button>}>` renders
  when `r.alpImp != null || r.alpOnImp != null`; its lines get
  `prefixed={x.count > 1}` and `hero` ALWAYS — the display size lives on BOTH
  implied re-reads for every wave, and the After-preferences lines are body
  size (no `hero` prop at all). User, 2026-09-20, in two steps: first "the alp
  v l/np is bigger than the alp v onp with no good reason" (one computation on
  two tables, not an answer plus a supporting reading), then "both implied 2pps
  should be big. the as-published after preferences should be body size" —
  implied 2PP is the page's basis and the table's figure, so it is the answer
  the panel was opened for whatever the house printed.
- Splitting was tried once before and rejected for a "hierarchy clash with the
  section eyebrows"; the run-in labels that replaced it were reverted too. The
  split is what the user picked on 2026-09-20 — leave it unless they say so.
- `tppHeading(cs)` now returns the constant `"After preferences (as published)"`
  (user, 2026-09-20) — the old single-contest "Two-party preferred" /
  "Three-cornered preferred" names are gone; the "(as published)" qualifier is
  what separates the section from the implied one beneath it. `tppHeading(tcs)`
  is still the call shape (it is window-exported).
- template.html, right after `.pd-k`: `.pd-k .hi-term { text-transform:
  inherit; letter-spacing: inherit; }` — Chrome's UA sheet resets both on
  `<button>` and `.hi-term` restores only font/colour, so without it the
  eyebrow printed as sentence-case "Implied 2PP".
## Verification

After `node .build/newtracker/build.mjs` (validator runs inside, should print
"validated NNN polls … Error: (none)"):

- Row payload: the built `index.html` (and the `9f09dca2` boot bundle) shows the row's
  `"tppFlows":NN` plus a `chg.d.flows` delta against the house's previous wave —
  grep for the row's URL fragment (e.g. the AFR article slug) and inspect the JSON.
- Display wiring: `grep -c 'respondent-allocated' index.html` → 1 (the note literal);
  `grep -c 'tppLines' index.html` → 2 (helper + call site survived the bundle);
  `grep -c '2025-election' index.html` → 1 (the JSX note, compiled to `jsx()` calls).
- Line ORDER/FORMAT can't be grepped — simulate it: the built `index.html` boot data
  lives in `const individualPolls = [...]` (the LAST `const X = [` before the row's
  url slug, NOT `agg2pp`/`pollsterTable`); JSON-parse that array, paste the
  `segDelta`/`tppContests`/`tppLines` helpers + a tiny `mat`/ChgParen printer into a
  node heredoc, and render each x. Two traps hit live: (a) find rows by `released`
  (ISO date) — `day` repeats across waves (28 matched the MAY RedBridge wave first);
  (b) remember babel escapes non-ASCII in helper bodies too if you copy them from the
  built file rather than the asset source.
- Section wiring (2026-09-20 split): `grep -c 'impliedLines' index.html` → 3
  (definition + call + a comment); `grep -o '"Implied 2PP"' index.html` present;
  old note literal "from these primaries under" and `pd-s-grp` both ABSENT.
- Visual check without the Chrome extension: serve the tree
  (`python3 -m http.server 8761 --bind 127.0.0.1`) and drive
  `~/node_modules/puppeteer-core` against the Chrome.app binary (the
  verify-copy-poll probe's recipe): click the Nth `.exp-btn`, wait for
  `.poll-detail`, read its `innerText` and `element.screenshot()`.
- COMPILED-CHILDREN TRAP: babel lowers JSX children to POSITIONAL args
  (`React.createElement("p", { className: "pd-k" }, label)`), so regexes of
  the `children:\s*"…"` shape match NOTHING even when a label is baked — grep
  the bare string and eyeball the positional arg around each offset instead.
- SHELL QUOTING: `node -e "…"` with mixed quotes is mangled by this shell
  ("Expected ',', got ')'" errors) and out-of-workspace /tmp writes are blocked
  by BOGAN mode — write verification scripts as `.build/tmp-*.mjs` inside the
  repo and delete them after (untracked `.build/tmp-*` files from other
  sessions exist; only remove your own).
- Remember babel escapes non-ASCII to `\uXXXX` in the built file — grep ASCII
  fragments only (see the auspol-built-html-verification user skill).

## Companion copy

The per-house undecided-basis explanation ("set aside" / "inside the pair" /
"not firm") has TWO homes since 7a3451f (2026-09-02): the Info glossary
`infoTerms()` "Undecided" term in the `d1a1d215` asset (~line 2911, same commit
`9f316a9`) AND the poll breakdown itself — an Essential row's 2PP line now states
"undecided N% inside the pair" inline via `tppLines` (the primaries tail is gated
to non-"tpp" bases). If the basis taxonomy changes, BOTH homes move together; see
the auspol-undecided-basis-display skill for the full three-base system.
