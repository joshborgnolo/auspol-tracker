---
name: auspol-tpp-pair-labelling
description: auspol-tracker — the 2025-flows 2PP pair renders as a FULL contest line spliced straight after the canonical pair via tppLines(cs,r) in a11e1559 (never a compact tail after the alt matchups); both lines get matchup prefixes + basis notes, the "respondent-allocated" note is keyed on contest kind + !derived — NEVER array index, because 3-cornered waves inject a DERIVED pair into tppContests.
source: auto-skill
extracted_at: '2026-08-31T07:41:32.853Z'
---

# Two-pair 2PP labelling in the expanded poll view (auspol-tracker)

Shipped 2026-08-31 across three commits: `9f316a9` (pair labels), `9fea364` (RedBridge
flows data), `dadf71d` (flows pair promoted from compact tail to a full adjacent line).
Only the Latest-polls `PollDetail` (a11e1559) renders the flows pair — the archive's
`ArchPollDetail` (d1a1d215) imports `tppContests` for flags/bars but has no flows line.

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
- "RedBridge / Accent" — since the 2026-08-31 convention reversal: Apr 53, May 52,
  Jun 55, Jul 50 (extractor commits from the Accent PDF `tppHist` column), Aug 52
  (hand-entered — that manual-ingest wave is invisible to extractor discovery; see
  the redbridge-accent-extraction skill's *Discovery gap* section).

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
- Remember babel escapes non-ASCII to `\uXXXX` in the built file — grep ASCII
  fragments only (see the auspol-built-html-verification user skill).

## Companion copy

The per-house undecided-basis explanation ("set aside" / "inside the pair" /
"not firm") lives in the Info glossary `infoTerms()` "Undecided" term in the
`d1a1d215` asset (~line 2911) — same commit `9f316a9`. If the basis taxonomy
changes, that term is its only home (static-summary has no glossary mirror).
