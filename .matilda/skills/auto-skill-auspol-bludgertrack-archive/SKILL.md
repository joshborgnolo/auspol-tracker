---
name: auspol-bludgertrack-archive
description: "when you need historical BludgerTrack data/pages (pre-fed2025 election cycles) that are gone from pollbludger.net: per-cycle path map + complete verified link index (2026-11-03). fedYYYY/bludgertrack/ only exists from fed2025; older cycles lived at /bludgertrackYYYY/ with bt-*.xml feeds (2019 cycle STILL LIVE, 2022 cycle Wayback-only, archive gap after Oct 2021); pre-2016 is blog posts only. Includes the archive-probing recipe that works while Wayback CDX/availability APIs are down."
source: auto-skill
extracted_at: '2026-11-02T23:13:18.452Z'
---

# BludgerTrack historical-cycle archive map (worked 2026-11-03)

What this is: verified map of where Poll Bludger's BludgerTrack data lives/lived
per federal election cycle, what is still online, every working archive link
found, and what was confirmed to NOT exist. All links below were exercised
2026-11-03; successes are hard facts, negatives are provisional (see CAVEATS).

The site's own fallback agent (`.build/extract-pollbludger.mjs`) reads the
CURRENT cycle's `fed2028/bludgertrack/xml/current.xml`, and
`auspol-external-aggregate-triage` documents that feed's anatomy. This skill
covers everything BEFORE the current cycle.

## 1. The three eras (how the URL scheme changed)

1. **fedYYYY era (current)** — `/fedYYYY/bludgertrack/` with `polldata.htm`,
   `leaders.htm`, `xml/current.xml`. `polldata.htm` ("Poll data" table page)
   **is new since fed2025**; it never existed for 2016/2019/2022.
2. **bludgertrackYYYY era** — standalone `/bludgertrackYYYY/` JS apps fed by
   `bt-*.xml` (no `polldata.htm`, no per-election `fed` dir). Exists for 2019
   and 2022 only. 2019 is still live; 2022 was deleted when the 2025 cycle
   rolled over.
3. **Pre-2016 blog era** — BludgerTrack debuted for the 2013 election as a
   Crikey interactive. No data feeds survive; only blog posts
   (quarterly-breakdown tables) and chart PNGs.

## 2. Per-cycle map

| Term | Home then | Status now | Data feed(s) | Coverage |
|---|---|---|---|---|
| 2025–28 (current) | `/fed2028/bludgertrack/` | LIVE | `xml/current.xml` | from May 2026 election |
| 2022–25 | `/fed2025/bludgertrack/` (`polldata.htm`, `leaders.htm`) | LIVE | `xml/current.xml` 752,501 B | `start=` 2022-05-21 → 2025-04-29 (whole term incl. 2025-05-03 election polls) |
| 2019–22 | `/bludgertrack2022/` | GONE (404) — Wayback only | `bt2020.xml` (VI+leaders bundle), `bt-leaders-output.xml` | archived Dec 2020 → Oct 2021; **campaign tail (post-Oct-2021 → 2022-05-21 election) not found in any archive** |
| 2016–19 | `/bludgertrack2019/` | **STILL LIVE (200)** | `bt-output.xml` 628,458 B, root-stamped 2019-05-17 (election eve) | `<date>` 2016-07-02 → 2019-05-16; 151 seat projections; nat + nsw/vic/qld/wa/sa + twoparty |
| pre-2016 | blog posts + Crikey interactive | posts archived | none (tables in post bodies, chart PNGs) | quarterly aggregates Jun 2014 → Jun 2017; 2013 debut = methodology doc only |

Bottom line ("how far back can you go"): **continuous machine-readable data
from 2016-07-02 → today**, with one archive gap (Nov 2021 → May 2022).
Quarterly aggregates reach Jun 2014; 2013 is methodology-text only.

## 3. Verified LIVE links (HTTP 200 fetched 2026-11-03)

- Current poll data page: `https://www.pollbludger.net/fed2028/bludgertrack/polldata.htm`
  (intro "since the May 2026 election"; the repo's extractor reads
  `xml/current.xml` under this dir)
- 2022–25 cycle Poll data page: `https://www.pollbludger.net/fed2025/bludgertrack/polldata.htm`
  — its intro copy "since the May 2019 election" is **stale**; the feed starts
  at the May 2022 election, verified from the XML itself
- 2022–25 cycle data feed (FULL TERM in one file):
  `https://www.pollbludger.net/fed2025/bludgertrack/xml/current.xml`
  (752,501 B; first `start="2022-05-21"`, last `start="2025-04-29"`;
  loaded by the shell `js/polldata.js` via relative `xml/current.xml`)
- 2016–19 cycle app dir: `https://www.pollbludger.net/bludgertrack2019/` (200)
- 2016–19 cycle data feed (FINAL election-eve export):
  `https://www.pollbludger.net/bludgertrack2019/bt-output.xml`
  (628,458 B; `<root date="2019-05-17 12:43:31">`; 2,484 trend/poll points)

## 4. Verified GONE (404 on live site)

- `https://www.pollbludger.net/bludgertrack2022/` and its `bt2020.xml`,
  `bt-leaders-output.xml` — deleted; Wayback only (§5)
- `https://www.pollbludger.net/fed2022/bludgertrack/…` (all forms) — never
  existed; WordPress permalink-guess 301-redirects the bare dir to a random
  2013 blog post, so "200 after redirects" is a TRAP — check `%{url_effective}`
- Same for `/fed2019/bludgertrack/…` and `/fed2016/bludgertrack/…`
- Re-confirmed 2026-11-10 (second session): fed2022 `xml/current.xml` HEAD =
  404 on live, and a whole-host CDX prefix query `url=pollbludger.net&filter=
  original:.*current\.xml$` returns ZERO captures — the modern-era
  `current.xml` feed was never archived under any cycle URL, so don't retry
  Wayback for it; use §5's `bt-*.xml` captures instead.

## 5. Wayback Machine links (verified captures)

2019–22 cycle (`/bludgertrack2022/`):
- App page shell (loads `js/voting.js`):
  `https://web.archive.org/web/20210117041954/https://www.pollbludger.net/bludgertrack2022/`
- VI+leaders bundle, last confirmed FULL capture (Oct 2021; 178,570 B;
  leaders `<charts>` points from 2018-08-25; `<root date="2021-10-11 19:05:53">`):
  `https://web.archive.org/web/20211012081351id_/https://www.pollbludger.net/bludgertrack2022/bt2020.xml`
- Same file, earliest bare-key capture: `…/web/20210120032248id_/…/bt2020.xml`
- Leaders feed sample (May 2021; note the `?_=…` cache-buster is PART of the URL):
  `https://web.archive.org/web/20210521074525/https://www.pollbludger.net/bludgertrack2022/bt-leaders-output.xml?_=1582546798681`
- Capture cadence: roughly weekly Dec 2020 → Oct 2021 (incl. `?_=…` keys, e.g.
  20211031132348 on `bt2020.xml?_=1613937534532`). **Nothing verified after
  Oct 2021** — re-run the CDX check in §9 when IA is healthy.

2016–19 cycle (`/bludgertrack2019/`):
- First dir capture (site launched ~Apr 2018): `…/web/20180430233018/https://www.pollbludger.net/bludgertrack2019`
- Mid-term XML capture (2019-03-28; 584,741 B; dates 2016-07-02→2019-03-15):
  `https://web.archive.org/web/20190328184744id_/https://www.pollbludger.net/bludgertrack2019/bt-output.xml`
- Post-election crawl of the frozen final file: `…/web/20190910201501/…/bt-output.xml`
- Crawlers kept re-hitting cache-buster keys for years (2022, 2024, 2025) —
  all serve the same frozen 2019-05-17 content as the live file.

fed2025 era (proof the `fedYYYY` scheme starts here):
- `https://web.archive.org/web/20230621000438/https://www.pollbludger.net/fed2025/bludgertrack/leaders.htm`
- `https://web.archive.org/web/20240828032255/https://www.pollbludger.net/fed2025/bludgertrack/polldata.htm`

Pre-2016 blog era (all `https://web.archive.org/web/<ts>/https://www.pollbludger.net/<slug>/`):
- `bludgertrack-2013-methodology/` — capture 20191023031459
- `bludgertrack-breakdowns-june-2014/` — 20210414162024
- `bludgertrack-quarterly-breakdown-september-2014/` — 20210415103332
- `…-december-2014/` — 20210411015024 · `…-march-2015/` — 20210411191811
- `…-june-2015/` — 20210411215624 · `…-december-2015/` — 20210417061608
- `…-march-2016/` — 20210414171431 · `…-may-2016/` — 20210421205910
- `…-june-2017/` — 20180501133713
- Chart PNG (2016 election-eve):
  `https://web.archive.org/web/20160918125810/https://crikey-uploads.s3.amazonaws.com/blogs.dir/6/files/2016/07/bludgertrack-2016-07-01.png`

## 6. Verified NEGATIVES (do not re-search blindly)

- Zero Wayback captures for any `/fedYYYY/bludgertrack/` URL pre-fed2025
  (playback probes at 2016/2019/2021/2022 timestamps → 404; availability API
  NONE across www/bare hosts for polldata.htm, index.htm, dir, xml/current.xml).
- Zero captures found on `crikey.com.au` / `blogs.crikey.com.au` BludgerTrack
  paths (2014–2016 timestamp probes → 404; CDX prefix query empty).
- Common Crawl: no captures of `fed2022/bludgertrack/polldata.htm` or the dir
  (CC-MAIN-2022-05, 2022-21, 2026-43), nor `fed2016` polldata (CC-MAIN-2018-05).
- Wikipedia's per-election polling articles confirm the era URLs
  (`action=parse … &prop=externallinks`): 2025-cycle article links the fed2025
  pages incl. the June-2023 leaders capture; 2016/2019/2022 articles link only
  blog posts — no static BludgerTrack URL.

## 7. Data schemas per era

- **Legacy XML** (`bt-output.xml`, `bt2020.xml`): `<root date>…<seats><seat
  name state><LNP2016|LNPYYYY><BaseSwing><CandidateStatus><Adjustment>
  <Projection><Probability>` projections; trend points
  `<point week="N"><date>YYYY-MM-DD</date><lnp>…<alp>…<grn>…<onp>…<*trend>`
  with per-state sections (nsw/vic/qld/wa/sa/twoparty); final point carries
  `last=`/`previous=` attrs. `bt2020.xml` adds `<leaders><charts>` with
  `pmNET/olNET/ppmNET(+trend)` and `date="M/D/YYYY"`.
- **Modern feed** (`fedYYYY/bludgertrack/xml/current.xml`): attribute-driven
  `<point start end pollster mode scope sample …><ALP>…</ALP>…`; `polldata.js`
  renders Start/End/Pollster/Mode/Scope/Sample/ALP/LNC/GRN/PHON/UND, then
  **ALP/L-NP 2pp = published previous-election-flows 2PP**, and
  **r/a = respondent-allocation** columns.
  `scope` is NAT, a state, OR A DEMOGRAPHIC GROUP: the feed keeps every
  house's published crosstabs (Male/Female; Age 18-34/35-49/50-64/65+; No
  tertiary/TAFE/Tech/University; household income; work status incl. Other;
  English only/LOTE; Christian/No religion; Own outright/Mortgage/Rent;
  RedBridge's Inner/Outer Metropolitan/Provincial/Rural). The 2022–25 table
  has them for Newspoll (pooled quarters), YouGov (weekly), RedBridge,
  Resolve and Essential (gender), DemosAU — the only pre-2025-election group
  readings the repo holds. The legacy feeds have no demographic scopes.
  Traps: some releases are garbled (YouGov 14–19 Mar 2025 cells shuffled;
  check each dim's samples sum to the n) and a few cells are typos (check
  primaries against the printed 2PP); RedBridge crosstabs carry no PHON.

## 8. Local copies pulled during the 2026-11-03 session (in /tmp — ephemeral)

- `/tmp/bt-fed2025.xml` — 752,501 B live 2022–25 feed
- `/tmp/bt2019-live.xml` — 628,458 B live 2016–19 final export
- `/tmp/bt2019.xml` — 584,741 B Wayback 2019-03-28 capture of same
- `/tmp/bt2022term.xml` — 178,570 B Wayback 2021-10-12 capture (2019–22 cycle)
- `/tmp/bt2022dir.html` — 2021-01-17 `/bludgertrack2022/` page shell
- `/tmp/bt2019page.html` — live `/bludgertrack2019/` page shell
Copy anything needed into the repo (or a data mirror) before /tmp is cleaned.

IN THE REPO since 24fbe427 (2026-11-03): the 2022–25 poll table (all
1,722 rows, every scope) as
`.build/analysis/group-poll-error-2025/bludgertrack-2022-25.json`, rebuilt
by `extract-bludgertrack.mjs` there (fetches the live feed). That folder's
README is the group poll-error analysis it fed (crosstabs v the AEC count
and the AES 2025; the site's election-test claims; seat-model checks).

## 9. Archive-probing recipe (works when IA is degraded)

IA's CDX index and availability API flap (504 / "Temporarily Offline"
interleaved with successes) — retry; never trust one failure as "no captures".

1. `curl -sI` the live candidate URLs first — old static dirs may survive
   (bludgertrack2019 did). Beware the WordPress permalink-guess 301 trap above.
2. CDX prefix lists:
   `…/cdx/search/cdx?url=pollbludger.net/<prefix>*&fl=timestamp,original,statuscode&collapse=urlkey&limit=N`
   — narrow prefixes only; domain-wide filtered queries 504 under load.
   `?_=…` cache-buster URLs are SEPARATE CDX keys and often carry the latest
   captures of a feed — grep them out only after listing.
3. Playback nearest-capture probes survive CDX outages:
   `curl -sL "https://web.archive.org/web/<yyyymmdd>id_/<exact-url>" -o out` —
   404 = no capture for that key; `id_` returns the raw body; the effective
   URL shows which capture you got.
4. Common Crawl backup: `https://index.commoncrawl.org/<IDX>-index?url=<exact-url>&output=json`
   — exact URLs only; records fetch via ranged GET on data.commoncrawl.org.
5. Wikipedia externallinks per polling article = which pollbludger.net URLs
   were live/linked per era.
6. Verify coverage in the FILE, never the URL: parse `<root date>` and the
   min/max `<date>`/`start=` values (this caught fed2025's stale "since May
   2019" blurb and proved bludgertrack2019's live file is the complete
   election-eve export).

## 10. Caveats

- IA (CDX + availability API) and Common Crawl were both degraded all day
  2026-11-03; every positive above comes from a successful fetch, every
  negative is provisional. The one re-check worth scheduling: last capture of
  `bludgertrack2022/bt2020.xml*` (probe
  `cdx?url=pollbludger.net/bludgertrack2022/bt2020.xml*&fl=timestamp&from=20211001`),
  i.e. whether ANY archive holds the final pre-election 2022 BludgerTrack.
