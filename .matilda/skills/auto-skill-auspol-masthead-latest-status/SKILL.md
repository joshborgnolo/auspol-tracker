---
name: auspol-masthead-latest-status
description: auspol-tracker — the redesign masthead's latest-poll status line ("Essential, 24–29 Sep" + ", 2 days ago, N polls"): TWO responsive homes in the 73de0c58 asset (phone .rd-head-compact span + laptop .rd-head-meta .meta-v) fed by ONE rdLatest derivation (D.latest.newest ~:372) but, since 2026-10-12 (2294c64), TWO render consts: rdLatestFact (big-screen meta — keeps bee7cf6's linked-TBC pending form) and rdLatestFactCompact (phone one-liner — SHEDS "TBC" for a fieldwork-pending wave, user call 2026-10-12: the compact form drops the word entirely; probe asserts phone TBC-free exactness AND laptop linked-TBC). Covers the pubSort/latest.newest derivation vs the released-sorted tables, URL precedence, the masthead-latest-link probe, and (2026-10-11) the published-AGE label chain LATEST_PUB_ISO → freshness(), its missing-`published` staleness failure mode on extractor-filed rows, and the filing-side day-precision `published` stamp as the house-grade fix.
source: auto-skill
updated_at: '2026-10-12'
extracted_at: '2026-09-30T00:00:00.000Z'
---

# Masthead latest-poll status block (redesign)

Shipped e00d2e6 (2026-09-30): the newest poll's name+fieldwork in the
masthead is THE SITE's own release link, styled invisible ("make it
invisible: there's no underline or link icon").

## 2026-10-12 split: big screen keeps the linked TBC, phone compact sheds it (2294c64)

Two user calls landed the same day, in order:
1. The masthead's `'Latest poll: DemosAU (MRP), TBC, today, 179 polls'`
   should drop TBC ("don't say TBC, just leave it out").
2. **Refinement**: keep TBC on BIG screens — the multi-line meta block
   ("Latest poll ⏎ DemosAU (MRP), TBC ⏎ published today") keeps it; only
   the compact one-line phone form ("… X, today, N polls") sheds it.

Landing shape (meanwhile bee7cf6 had raced ahead making EVERY TBC a
per-house linked `.rd-tbc` via `field-tbc.mjs` — worth a rebase read each
time this area moves):

- `rdLatestFact` (~:382) — the meta block's fact. Pending wave:
  `<>{pollster link}, {rdFieldTbc(rdLatest)}</>` (bee7cf6's form, kept in
  full — the pollster opens the release, the TBC opens the house's
  dates page). `rdFieldTbc` is a BARE GLOBAL defined in rd-allpolls.jsx's
  layer — auspol-bare-global-shadow applies to this 73de0c58 use.
- `rdLatestFactCompact` (~:389, NEW) — the phone one-liner's fact:
  `fieldPending ? "" : ", " + field` — pollster alone when pending, no
  ", " either (the sentence's own trailing comma reads "… DemosAU (MRP), today, …").
- Phone home (~:459) `<b>Latest poll</b> {rdLatestFactCompact}, …`;
  meta-v home (~:473) keeps `{rdLatestFact}` alone in `.meta-v` with a
  fresh-dot button and a `.meta-s` "published …" line — that meta-v form
  is what the user calls "big screens".

Reconciliation discipline when a sibling lands the OPPOSING contract at
the same code point (whatever is on origin later is the default): rebase
onto their commit, keep their machinery everywhere, carve YOUR user's
exception into the exact surface they named, update the SAME doc mirrors
they'd have (MATILDA.md DemosAU bullet, gen-data's fieldwork-pending
comment), and extend the probe BOTH directions before amending the
in-flight commit (its message must describe the final contract, not the
superseded intermediate one).

## Two homes, ONE derivation (edit them together, like auspol-detail-meta-band)

In `.build/newtracker/assets/73de0c58-f11f-4793-9f90-77e583ab051b.js`:

- **rdLatest const, ~:372** — `rd ? (D.latest.newest || null) : null`
  (gen-data's `latest.newest`; the older pollsterTable-sorted form died
  with the NEWEST_PUB work — same pubSort spirit, one canonical home).
  pollsterTable is gen-data §7 (:2239) — ONE ROW PER HOUSE (the house's
  newest poll), each carrying `url`, `releaseUrl`, `releaseHub`,
  `methodUrl` conditionally. `pubSort` = `p.published || p.date` —
  the newest house row ranks by PUBLICATION date, where the Latest-polls`
  tables rank by FIELDWORK `released`. Don't "fix" the sort key to match
  the tables: the masthead tells the reader what was published latest.
- **rdLatestFact render const** — link-or-plain node shared by both
  homes so they can never drift:
  `(rdLatest.releaseUrl || rdLatest.url) ? <a className="mh-latest" href={…} target="_blank" rel="noopener noreferrer">{…}</a> : plain text`.
  Precedence `releaseUrl || url` mirrors the archive emitter at
  rd-allpolls.jsx:693 and gen-data :2273-2277 (releaseUrl = pollster's
  own page; `url` may cite media coverage).
- **Phone home, ~:415** — `<div className="rd-head-compact">` sentence:
  `<span><b>Latest poll</b> {rdLatestFact}, {fresh.label.toLowerCase()}, {D.latest.pollsTracked} polls</span>`.
  Only "Essential, 24–29 Sep" is linked; the age/count suffix is NOT
  (user's example named exactly the pollster+fieldwork part).
- **Laptop home, ~:422-430** — `.rd-head-meta .meta-item` with
  `<span className="meta-k">Latest poll</span>` and the fresh-dot
  toggle button inside `.meta-v` (rd.css:423 styles the value row).
- The fallback chain is deliberate: no `rdLatest` (non-rd design or no
  rows) → `D.latest.published`; no URL on the row → plain text. The
  old-design masthead's own "Last poll" meta (:448) shows only
  `D.latest.published` — NOT wired, the rd line is the one readers saw.

## The invisible-link CSS (auspol-content-link-colour pattern 1)

In `.build/newtracker/assets/rd.css` beside the other masthead rules
(~:426-431, right after `body.rd .rd-head-compact { display: none; }`,
BEFORE the `head-meta-compact` !important line):

```css
body.rd a.mh-latest { color: inherit; text-decoration: none; }
body.rd a.mh-latest:focus-visible { outline: 2px solid var(--accent, currentColor); outline-offset: 2px; border-radius: 2px; }
```

- `color: inherit` keeps the CURRENT look exactly: phone `.rd-head-compact`
  sentence ink is ink-3 (b-part ink), laptop `.meta-v` ink is ink
  (rd.css:423).
- No `a:hover`/generic `a` rules exist in template.html or rd.css (audited
  2026-09-30), so the no-underline standing is complete; no hover
  underline was added BY USER DIRECTION (overrides the usual
  focus/hover-underline house language for this one class) — only the
  keyboard `focus-visible` accent outline ships, matching
  a.pollster-link's focus rule (template.html :2072).
- The ↗ icon needs no suppression: plink-marks exist only where JSX
  writes the span; a.mh-latest never carries one.

## Verification

`.matilda/probe/masthead-latest-link.mjs` (gitignored; `git add -f` —
a bare `git add` on it exits 1 which SILENTLY busts an && chain before
`git commit`/`rebase --continue`; server+CDP page modelled on
phone-evlist-tap.mjs): parses `data/polls.json`, sorts by
`published || date` for the EXPECTED newest row, then at 390px and
1280px asserts — a.mh-latest exists in the right masthead home, text =
the pollster alone (the ", " + field sits outside the link), href = that row's
computed text-decoration-line none, computed colour = parent's
(inherit worked), no plink/apd-ext spans inside, the stylesheet ships
both rules. ALL GREEN at ship time. Built-artifact check:
`grep -c mh-latest index.html` = 3 (one compiled className + two CSS
rules; babel's \uXXXX escaping doesn't touch ASCII identifiers —
auspol-built-html-verification).
