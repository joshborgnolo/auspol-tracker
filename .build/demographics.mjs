/* demographics.mjs – builds data/demographics.json: first-preference vote by
   gender, age (or generation), education, income, state, location, housing
   and language at home, per poll wave, as each pollster groups it. The
   Snapshot's vote-by-group panel and its Info entry are drawn from this file.

   Runs itself: the YouGov/News24, DemosAU, RedBridge and Resolve updaters
   call it after every new wave (non-fatal), and the weekly crosstabs-update
   workflow (.build/crosstabs-updater.sh) runs it too; it finds what the file
   doesn't hold yet.
     YouGov    – the crosstab chart of each Pulse wave (.build/crosstab-
                 sources.mjs): gender, age bands, generations, education,
                 location (Feb 2026 on), housing (Mar on), state and language
                 (Jun on) – whichever columns that wave carries (they changed
                 over 2026). Its household-income columns are read too, but
                 only for the All-polls demographics facet (no house cuts
                 income like another, so it joins no common group –
                 .build/newtracker/demo-groups.mjs' header). Its employment,
                 parental-status and class columns are not read.
     DemosAU   – the Gender, Age, Education, Location and Housing Tenure
                 charts (and Language Status from May) in the wave's report
                 PDF, measured from the rendered bars (.build/demosau-charts
                 .mjs); from the April 2026 report. The four 2025–26 national
                 waves before it print the same breakdowns in layouts the
                 measurer doesn't know (July 2025, 6 Jan, 21 Jan and 20 Feb
                 2026) or as image-only charts (21 Jan 2026) – hand-entered
                 in DEMOSAU_EARLY_DEMO below, the 21 Jan wave measured from
                 a 300-dpi render of its report. Its Income chart (personal
                 income) is read to the same facet-only end as YouGov's.
     DemosAU (MRP) / YouGov (MRP) – the two MRP reports print their
                 demographic tables as native text: hand-entered in
                 DEMOSAU_MRP_DEMO / YOUGOV_MRP_DEMO below (their Tas, NT and
                 ACT rows are kept as printed – the common state set's
                 smaller-region merge only knows YouGov's ACT/NT/Tas cut).
     RedBridge – the "First preference vote intention" table in the report
                 text extract-redbridge.mjs caches (.build/redbridge-src/),
                 from February 2026: generation, gender, location, education,
                 home ownership and vote softness. The December 2025 and
                 January 2026 reports print the same table under an older
                 title – they ride FIRST_EXTRA through the same reader. The
                 July 2025 wave's AFR Datawrapper table is hand-entered in
                 REDBRIDGE_JUL_DEMO, the October 2025 wave's own report PDF
                 in REDBRIDGE_OCT_DEMO, and the November 2025 wave – the
                 one 2025 wave with no Accent report – is hand-entered in
                 REDBRIDGE_NOV_DEMO from the AFR piece's generational
                 table, recovered through Wikipedia's subpopulation
                 chapter and verified against the piece's own text. That
                 leaves ONE 2025 wave filing nothing: 8 Sep's breakdowns,
                 a protected tweet's two-wave pool.
     Resolve   – the SMH Political Monitor interactive's age, gender and
                 state series, every month of the term, rebuilt each run from
                 one fetch (values decoded as extract-resolve-rpm.mjs does).
     Essential – the report's "Primary Vote" chart visual bars (Overall,
                 Male/Female, 18-34/35-54/55+), already crawled weekly into
                 data/essential-report.csv by extract-essential-report.mjs;
                 the wave is matched to the poll row on date (within five
                 days) and headline primaries. Independents/other and
                 undecided fold together into oth, as the poll rows' ind
                 field does.
     Roy Morgan– three recurring formats carry public breakdowns, all
                 hand-entered in ROYMORGAN_DEMO below and verified against
                 the release text, figure by figure (Wikipedia's
                 subpopulation tables carry the same numbers and reconcile
                 except where the release itself was re-read to settle a
                 transcription slip): the four-weekly aggregates of Nov 2025,
                 Dec 2025 and Feb 2026 print prose breakdowns by gender, age
                 band and the six states; the weekly releases of Mar 30 –
                 May 10 2026 print a full demographic table on the page;
                 release 10363's PDF (Sep 29 2026) prints state tables.
                 Before Nov 2025 the aggregates print two-party-by-group
                 only, and from mid-May 2026 the weekly releases carry no
                 demographic table at all ("contact Julian McCrann" for
                 detail). Not in HOUSES: which waves print which dims is
                 unpredictable, so stale/dropped checks would misfire – a
                 new wave's findings cache is instead probed for the shapes
                 a demographic release has taken (the `reminders` watch at
                 the end of this file).
                 harmonize joins only NSW/Vic/Qld (no Tas or ACT/NT cut →
                 no Rest of Australia).
   Newspoll   – the quarterly aggregate Newspoll publishes to The
                 Australian: one reading per release pooled from about ten
                 weeks of waves (filed in polls.json as NO_AGG "Newspoll
                 (pooled)" rows), printing first-preference and two-party
                 by gender, age bands 18–34/35–49/50–64/65+, the five
                 mainland states, education No tertiary / TAFE / University,
                 household income, working status, language at home and
                 religion (the April–June and July–September 2026 quarters
                 add housing tenure: owned outright / owned with mortgage /
                 rented; the January–March 2026 quarter does not print it),
                 hand-entered in NEWSPOLL_DEMO below and verified
                 against the printed table (the same figures sit on
                 Wikipedia's subpopulation page and reconcile). New
                 quarters are filed by .build/extract-newspoll-quarterly.mjs
                 into data/newspoll-quarterly.json (the polls.json row plus
                 the full table, re-verified against source every run) and
                 merged in beneath NEWSPOLL_DEMO's hand-entered keys – see
                 the Newspoll loop below. "No
                 tertiary" spans Year-12-or-less AND TAFE-or-trade voters,
                 so no common education group holds every wave's school row
                 – harmonize drops the dim unless the wave prints a school
                 row of its own. Newspoll cuts no Tas/ACT/NT, so its states
                 join NSW/Vic/Qld/SA/WA only. Not in HOUSES: a pooled row
                 whose breakdowns stay unentered, and a quarter gone
                 quiet, surface as `reminders` (the watch at the end of
                 this file).
   Fox & Hedgehog – every release's full-report PDF prints a
                 "PRIMARY VOTE, 3PP & TPP – DEMOGRAPHICS" table (page 8):
                 gender, age bands 18–34/35–49/50–64/65+, state as
                 NSW/Vic/Qld/"Other States/Terr." and education
                 High School / Trade Cert. / University, hand-entered in
                 FOXHEDGEHOG_DEMO below and verified against the PDFs
                 figure by figure. Four waves ran (Jan, Feb, Mar, May 2026)
                 then the series stopped. Not in HOUSES, so no
                 stale/dropped checks.
   Freshwater –  each release post's Data-Tables xlsx carries a Primary
                 Vote crosstab "by CROSSBREAKS": gender, three age bands,
                 household income and the state split, hand-entered in
                 FRESHWATER_DEMO after extraction and cell-by-cell
                 verification. Only the Oct 2025 and Jan 2026 data tables
                 print it – from March 2026 the workbook's Primary Vote is
                 national totals only, so later waves file nothing.
                 Not in HOUSES.
   Groups are kept exactly as each house draws them – the age bands differ
   (Resolve and DemosAU 18–34/35–54/55+, YouGov 18–34/35–49/50+, RedBridge by
   generation) – with labels only tidied. Party keys alp/lnp/onp/grn/oth;
   independents and every smaller party are oth. Shares are stored as
   published; the page rescales each group to 100.

   Nothing is saved on a guess. Every table passes the gate in
   crosstab-parse.mjs first: each group's shares sum to about 100, and a
   table's all-voters column matches the wave's published primaries. A table
   that fails, a chart measured off whole percentages (a layout the measurer
   doesn't know), or a source not reachable yet leaves the wave pending: it
   is retried every run, never skipped. Only KNOWN_SKIP below – each entry
   checked by hand – marks a wave as having no breakdowns. A wave still
   pending STALE_DAYS after its fieldwork closed is listed as `stale`, and
   the weekly run fails on it so a person (or agent-repair) looks.

   A group can also vanish while every wave reads cleanly: a house renames a
   column or moves a chart under a new heading, the reader stops finding it,
   and the tables go on passing the gate without it. So a group a house
   printed in two waves running that is missing from its newest wave on file
   is listed as `dropped`, and the weekly run fails on that too – until the
   reader learns the new name, or KNOWN_DROP records (checked by hand) that
   the house really stopped, keyed to the first wave without it so a later
   drop alarms again.

   The hand-entered Roy Morgan and Newspoll waves get neither check. That
   once let a printed quarterly sit unentered for three months (April–June
   2026, published 3 Jul; filed in October), so the two houses watch for
   their own release shapes and surface misses as `reminders` – a reminder
   fails the weekly run until the wave is hand-entered, or KNOWN_SKIP
   records it as checked by hand.

   Usage: node .build/demographics.mjs [--refresh]
     --refresh  re-read every wave, not just the new ones
   Last line: DEMO_STATUS {"changed":…,"added":[…],"pending":[…],"stale":[…],"dropped":[…],"reminders":[…],"skipped":[…]} */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, youGovSource, youGovCrosstab, demosauReport, resolveData } from "./crosstab-sources.mjs";
import { youGovDims, DEMOS_DIM, demosLabel, redbridgeTable, resolveWaves, essentialWaves, essentialMatch, dimsProblem, totalProblem } from "./crosstab-parse.mjs";
import { measureCharts, FIT_LIMIT } from "./demosau-charts.mjs";
import { watchReminders } from "./demo-watch.mjs";

const OUT = path.join(ROOT, "data", "demographics.json");
const FIRST = "2026-02-01";            // the automated readers' window opens here; earlier waves with
                                       // breakdowns ride FIRST_EXTRA (read through the readers) or the
                                       // hand-entered tables below (checked by hand, figure by figure)
const FIRST_EXTRA = new Set(["YouGov|2026-01-27",     // the Sky News Pulse wave's Infogram crosstab, found via KNOWN_IG
  "RedBridge/Accent|2025-12-12", "RedBridge/Accent|2026-01-29"]);  // the older report layout, cached (see redbridgeTable)
const FIRST_ESS = "2025-05-03";        // Essential's CSV visuals run since 2023 – read from the term's start
const HOUSES = ["YouGov", "DemosAU", "RedBridge/Accent", "Resolve", "Essential"];
const STALE_DAYS = 16;                 // a week to publish, then a weekly retry, then someone looks
const RESOLVE_MATCH_DAYS = 4;          // the interactive can date a month a day or two off the poll row
// The hand-entered-house watch (reminders) lives in demo-watch.mjs.

/* A wave checked by hand and found to carry no breakdowns: "house|date" →
   why. Clears both the automated-house loop and the watch reminders below. */
const KNOWN_SKIP = {
  "YouGov|2026-06-16": "the wave's article carries no crosstab",
  "RedBridge/Accent|2026-03-27": "filed from the AFR article – Accent's March report was never cached",
};

/* Groups a house really stopped printing, checked by hand: "house|dim|group|
   date of the first wave without it" → why. See `dropped` in the header. */
const KNOWN_DROP = {
  // 27 Jan 2026 cut the young band alone (18–24 and 25–34); from 10 Feb it
  // prints the pair as one 18–34 band
  "YouGov|age|18–24|2026-02-10": "YouGov printed 18–24 and 25–34 only on 27 Jan 2026; from 10 Feb they are one 18–34 band",
  "YouGov|age|25–34|2026-02-10": "YouGov printed 18–24 and 25–34 only on 27 Jan 2026; from 10 Feb they are one 18–34 band",
  "YouGov|age|50–64|2026-03-24": "YouGov printed 50–64 and 65+ only in Jan–Mar 2026; from 24 Mar it cut by generation instead, and from Jun its oldest band is 50+",
  "YouGov|age|65+|2026-03-24": "YouGov printed 50–64 and 65+ only in Jan–Mar 2026; from 24 Mar it cut by generation instead, and from Jun its oldest band is 50+",
  // four income brackets ran 27 Jan–10 Feb 2026 only (10 Feb printed just
  // the top two); no income 24 Feb–24 Mar, and from 7 Apr the scheme is the
  // two-bracket under/over $100k
  "YouGov|income|$100–149k|2026-02-24": "YouGov's four-bracket household-income scheme ran 27 Jan–10 Feb 2026; no income columns until 7 Apr's two-bracket under/over-$100k scheme",
  "YouGov|income|$150k+|2026-02-24": "YouGov's four-bracket household-income scheme ran 27 Jan–10 Feb 2026; no income columns until 7 Apr's two-bracket under/over-$100k scheme",
};

/* Roy Morgan breakdowns, hand-entered from the releases (see the house note
   in the header). Keyed by the poll row's date; shares as printed, every
   figure re-read from the release text before entry. Weekly table waves
   carry `total` from the table's All-electors column (it matches the poll
   row exactly). The three prose four-weekly aggregates carry none – their
   national primary is a 4-week pool, not any single poll row. */
const ROYMORGAN_DEMO = {
  "2025-11-16": {
    source: "https://www.roymorgan.com/findings/9951-federal-voting-intention-november-16-2025",
    dims: {
      gender: {
        Women: { alp: 34, lnp: 26, onp: 11.5, grn: 15, oth: 13.5 },
        Men: { alp: 31.5, lnp: 28.5, onp: 16.5, grn: 10, oth: 13.5 },
      },
      age: {
        "18–34": { alp: 31.5, lnp: 19.5, onp: 8, grn: 25, oth: 16 },
        "35–49": { alp: 32, lnp: 24, onp: 14, grn: 14.5, oth: 15.5 },
        "50–64": { alp: 33.5, lnp: 26, onp: 18.5, grn: 7.5, oth: 14.5 },
        "65+": { alp: 34, lnp: 39, onp: 15, grn: 3.5, oth: 8.5 },
      },
      state: {
        NSW: { alp: 33.5, lnp: 28.5, onp: 14.5, grn: 10.5, oth: 13 },
        Vic: { alp: 33.5, lnp: 27.5, onp: 10.5, grn: 16, oth: 12.5 },
        Qld: { alp: 28, lnp: 27, onp: 18, grn: 12, oth: 15 },
        WA: { alp: 32.5, lnp: 27.5, onp: 16.5, grn: 11, oth: 12.5 },
        SA: { alp: 37.5, lnp: 26, onp: 11.5, grn: 15, oth: 10 },
        Tas: { alp: 35.5, lnp: 26.5, onp: 9, grn: 11, oth: 18 },
      },
    },
  },
  "2025-12-14": {
    source: "https://www.roymorgan.com/findings/9956-federal-voting-intention-december-14-2025",
    dims: {
      gender: {
        Women: { alp: 31.5, lnp: 26, onp: 13, grn: 17.5, oth: 12 },
        Men: { alp: 32.5, lnp: 27.5, onp: 18, grn: 9, oth: 13 },
      },
      age: {
        "18–34": { alp: 32.5, lnp: 17, onp: 10, grn: 26.5, oth: 14 },
        "35–49": { alp: 32.5, lnp: 23.5, onp: 15.5, grn: 15, oth: 13.5 },
        "50–64": { alp: 30.5, lnp: 29, onp: 20.5, grn: 8, oth: 12 },
        "65+": { alp: 33, lnp: 37, onp: 16, grn: 4.5, oth: 9.5 },
      },
      state: {
        NSW: { alp: 33.5, lnp: 25.5, onp: 17.5, grn: 11.5, oth: 12 },
        Vic: { alp: 32.5, lnp: 28.5, onp: 10, grn: 15.5, oth: 13.5 },
        Qld: { alp: 28, lnp: 27, onp: 22, grn: 12.5, oth: 10.5 },
        WA: { alp: 30, lnp: 24, onp: 17.5, grn: 15.5, oth: 13 },
        SA: { alp: 35.5, lnp: 29, onp: 13.5, grn: 12.5, oth: 9.5 },
        Tas: { alp: 38.5, lnp: 19, onp: 12, grn: 12, oth: 18.5 },
      },
    },
  },
  "2026-02-01": {
    source: "https://www.roymorgan.com/findings/9971-federal-voting-intention-february-2-2026",
    dims: {
      gender: {
        Women: { alp: 30, lnp: 25, onp: 17.5, grn: 15.5, oth: 12 },
        Men: { alp: 30, onp: 26, lnp: 23, grn: 9.5, oth: 11.5 },
      },
      age: {
        "18–34": { alp: 27.5, grn: 25.5, lnp: 17.5, onp: 15, oth: 14.5 },
        "35–49": { alp: 31.5, onp: 20, lnp: 21.5, grn: 13.5, oth: 13.5 },
        "50–64": { alp: 31, onp: 27, lnp: 24, grn: 8, oth: 10 },
        "65+": { alp: 30, lnp: 32, onp: 24.5, grn: 4, oth: 9.5 },
      },
      state: {
        NSW: { alp: 30, onp: 25.5, lnp: 22, grn: 11.5, oth: 11 },
        Vic: { alp: 30.5, lnp: 27, onp: 17.5, grn: 13, oth: 12 },
        Qld: { alp: 27.5, onp: 24, lnp: 23.5, grn: 14, oth: 11 },
        WA: { alp: 29, lnp: 27, onp: 20, grn: 13, oth: 11 },
        SA: { alp: 33.5, lnp: 22, onp: 20.5, grn: 12, oth: 12 },
        Tas: { alp: 31, lnp: 21, grn: 17, onp: 15.5, oth: 15.5 },
      },
    },
  },
  "2026-04-05": {
    source: "https://www.roymorgan.com/findings/10178-federal-voting-intention-april-7-2026",
    total: { alp: 30.5, lnp: 24, onp: 21.5, grn: 12, oth: 12 },
    dims: {
      gender: {
        Men: { alp: 29, lnp: 22.5, onp: 27, grn: 9, oth: 12.5 },
        Women: { alp: 32.5, lnp: 25, onp: 16.5, grn: 15, oth: 11 },
      },
      age: {
        "18–34": { alp: 26.5, lnp: 14, onp: 18.5, grn: 27, oth: 14 },
        "35–49": { alp: 37.5, lnp: 19.5, onp: 20, grn: 10.5, oth: 12.5 },
        "50–64": { alp: 31, lnp: 24, onp: 30.5, grn: 6.5, oth: 8 },
        "65+": { alp: 27.5, lnp: 36.5, onp: 18, grn: 5, oth: 13 },
      },
    },
  },
  "2026-04-12": {
    source: "https://www.roymorgan.com/findings/10187-federal-voting-intention-april-13-2026",
    total: { alp: 30, onp: 24.5, lnp: 22.5, grn: 12.5, oth: 10.5 },
    dims: {
      gender: {
        Men: { alp: 28, onp: 29.5, lnp: 23, grn: 9, oth: 10.5 },
        Women: { alp: 32.5, onp: 19, lnp: 21.5, grn: 16.5, oth: 10.5 },
      },
      age: {
        "18–34": { alp: 26.5, onp: 19, lnp: 15, grn: 27.5, oth: 12 },
        "35–49": { alp: 30.5, onp: 23.5, lnp: 20, grn: 14, oth: 12 },
        "50–64": { alp: 31, onp: 29, lnp: 20.5, grn: 6, oth: 13.5 },
        "65+": { alp: 32.5, onp: 25.5, lnp: 33, grn: 3, oth: 6 },
      },
    },
  },
  "2026-04-19": {
    source: "https://www.roymorgan.com/findings/10191-federal-voting-intention-april-20-2026",
    total: { alp: 30.5, lnp: 23, onp: 21.5, grn: 13.5, oth: 11.5 },
    dims: {
      gender: {
        Men: { alp: 28.5, lnp: 24.5, onp: 24, grn: 11, oth: 12 },
        Women: { alp: 33, lnp: 21, onp: 19, grn: 15.5, oth: 11.5 },
      },
      age: {
        "18–34": { alp: 33, lnp: 12, onp: 15, grn: 27.5, oth: 12.5 },
        "35–49": { alp: 29, lnp: 16.5, onp: 22, grn: 16, oth: 16.5 },
        "50–64": { alp: 27, lnp: 29, onp: 28.5, grn: 5.5, oth: 10 },
        "65+": { alp: 34, lnp: 34, onp: 20.5, grn: 3.5, oth: 8 },
      },
    },
  },
  "2026-04-26": {
    source: "https://www.roymorgan.com/findings/10201-federal-voting-intention-april-27-2026",
    total: { alp: 30, lnp: 22.5, onp: 22.5, grn: 14, oth: 11 },
    dims: {
      gender: {
        Men: { alp: 26, lnp: 23, onp: 27.5, grn: 11.5, oth: 12 },
        Women: { alp: 33.5, lnp: 22, onp: 17.5, grn: 16, oth: 11 },
      },
      age: {
        "18–34": { alp: 33, lnp: 14.5, onp: 13, grn: 25, oth: 14.5 },
        "35–49": { alp: 29, lnp: 20, onp: 21.5, grn: 16.5, oth: 13 },
        "50–64": { alp: 28.5, lnp: 20, onp: 33.5, grn: 9, oth: 9 },
        "65+": { alp: 29, lnp: 35.5, onp: 22, grn: 4.5, oth: 9 },
      },
    },
  },
  "2026-05-03": {
    source: "https://www.roymorgan.com/findings/10211-federal-voting-intention-may-4-2026",
    total: { alp: 29.5, lnp: 24, onp: 21.5, grn: 13, oth: 12 },
    dims: {
      gender: {
        Men: { alp: 28.5, lnp: 23.5, onp: 24.5, grn: 12, oth: 11.5 },
        Women: { alp: 30.5, lnp: 24.5, onp: 18.5, grn: 14, oth: 12.5 },
      },
      age: {
        "18–34": { alp: 24.5, lnp: 11.5, onp: 17, grn: 31, oth: 16 },
        "35–49": { alp: 38, lnp: 19, onp: 18.5, grn: 11.5, oth: 13 },
        "50–64": { alp: 28.5, lnp: 26, onp: 28.5, grn: 6.5, oth: 10.5 },
        "65+": { alp: 26.5, lnp: 40, onp: 22.5, grn: 3, oth: 8 },
      },
    },
  },
  "2026-05-10": {
    source: "https://www.roymorgan.com/findings/10218-federal-voting-intention-may-11-2026",
    total: { alp: 30.5, lnp: 25, onp: 22, grn: 11.5, oth: 11 },
    dims: {
      gender: {
        Men: { alp: 28.5, lnp: 26, onp: 26.5, grn: 7.5, oth: 11.5 },
        Women: { alp: 32.5, lnp: 24.5, onp: 17.5, grn: 15.5, oth: 10 },
      },
      age: {
        "18–34": { alp: 31, lnp: 17, onp: 15.5, grn: 23, oth: 13.5 },
        "35–49": { alp: 29.5, lnp: 20, onp: 22.5, grn: 14, oth: 14 },
        "50–64": { alp: 30, lnp: 25, onp: 26.5, grn: 9.5, oth: 9 },
        "65+": { alp: 31, lnp: 37.5, onp: 23, grn: 1.5, oth: 7 },
      },
    },
  },
  "2026-09-27": {
    source: "https://roymorgan-cms-prod.s3.ap-southeast-2.amazonaws.com/wp-content/uploads/2026/09/29053832/10363-Federal-Voting-Intention-September-29-2026.pdf",
    total: { alp: 26, lnp: 22.5, onp: 25.5, grn: 14.5, oth: 11 },
    dims: {
      state: {
        NSW: { alp: 28.5, lnp: 22, onp: 26.5, grn: 12, oth: 11 },
        Vic: { alp: 25.5, lnp: 26.5, onp: 23, grn: 16.5, oth: 9 },
        Qld: { alp: 20.5, lnp: 21, onp: 32.5, grn: 16, oth: 10 },
        SA: { alp: 28, lnp: 26.5, onp: 18.5, grn: 15.5, oth: 10.5 },
        WA: { alp: 27.5, lnp: 20, onp: 26, grn: 15, oth: 12 },
      },
    },
  },
};

/* Fox & Hedgehog breakdowns, hand-entered from each release's full-report
   PDF ("PRIMARY VOTE, 3PP & TPP – DEMOGRAPHICS", page 8). Their pure-black
   cells render as images, so the few cells the text layer drops were read
   off a 300-dpi render and confirmed by the row sums (every row sums to
   exactly 100, and each table's All row matches the poll row exactly). */
const FOXHEDGEHOG_DEMO = {
  "2026-01-06": {
    source: "https://www.foxhedgehog.com.au/news-den/the-daily-telegraph-national-voter-sentiment-survey",
    dims: {
      gender: {
        Men: { alp: 31, lnp: 27, onp: 23, grn: 9, oth: 10 },
        Women: { alp: 27, lnp: 23, onp: 19, grn: 20, oth: 11 },
      },
      state: {
        NSW: { alp: 29, lnp: 27, onp: 19, grn: 13, oth: 12 },
        Vic: { alp: 26, lnp: 28, onp: 19, grn: 18, oth: 9 },
        Qld: { alp: 27, lnp: 25, onp: 25, grn: 11, oth: 12 },
        "Other States/Terr.": { alp: 33, lnp: 17, onp: 23, grn: 17, oth: 10 },
      },
      age: {
        "18–34": { alp: 27, lnp: 18, onp: 14, grn: 29, oth: 12 },
        "35–49": { alp: 32, lnp: 24, onp: 19, grn: 14, oth: 11 },
        "50–64": { alp: 28, lnp: 23, onp: 28, grn: 10, oth: 11 },
        "65+": { alp: 28, lnp: 35, onp: 24, grn: 4, oth: 9 },
      },
      education: {
        "High School": { alp: 30, lnp: 26, onp: 25, grn: 11, oth: 8 },
        "Trade Cert.": { alp: 27, lnp: 23, onp: 25, grn: 14, oth: 11 },
        University: { alp: 29, lnp: 24, onp: 12, grn: 21, oth: 14 },
      },
    },
    total: { alp: 29, lnp: 25, onp: 21, grn: 14, oth: 11 },
  },
  "2026-02-19": {
    source: "https://www.foxhedgehog.com.au/news-den/the-daily-telegraph-february-2026-national-voter-sentiment-survey",
    dims: {
      gender: {
        Men: { alp: 30, lnp: 24, onp: 28, grn: 9, oth: 9 },
        Women: { alp: 30, lnp: 24, onp: 23, grn: 15, oth: 8 },
      },
      state: {
        NSW: { alp: 31, lnp: 26, onp: 22, grn: 10, oth: 11 },
        Vic: { alp: 26, lnp: 23, onp: 30, grn: 13, oth: 8 },
        Qld: { alp: 28, lnp: 25, onp: 29, grn: 10, oth: 8 },
        "Other States/Terr.": { alp: 37, lnp: 22, onp: 21, grn: 15, oth: 5 },
      },
      age: {
        "18–34": { alp: 35, lnp: 21, onp: 15, grn: 21, oth: 8 },
        "35–49": { alp: 32, lnp: 20, onp: 26, grn: 14, oth: 8 },
        "50–64": { alp: 27, lnp: 22, onp: 31, grn: 8, oth: 12 },
        "65+": { alp: 25, lnp: 34, onp: 30, grn: 3, oth: 8 },
      },
      education: {
        "High School": { alp: 26, lnp: 23, onp: 33, grn: 10, oth: 8 },
        "Trade Cert.": { alp: 31, lnp: 23, onp: 25, grn: 11, oth: 10 },
        University: { alp: 34, lnp: 28, onp: 15, grn: 15, oth: 8 },
      },
    },
    total: { alp: 30, lnp: 24, onp: 25, grn: 12, oth: 9 },
  },
  "2026-03-25": {
    source: "https://www.foxhedgehog.com.au/news-den/the-daily-telegraph-march-2026-national-voter-sentiment-survey",
    dims: {
      gender: {
        Men: { alp: 33, lnp: 25, onp: 23, grn: 8, oth: 11 },
        Women: { alp: 27, lnp: 22, onp: 23, grn: 17, oth: 11 },
      },
      state: {
        NSW: { alp: 34, lnp: 21, onp: 22, grn: 13, oth: 10 },
        Vic: { alp: 29, lnp: 28, onp: 18, grn: 14, oth: 11 },
        Qld: { alp: 23, lnp: 26, onp: 30, grn: 10, oth: 11 },
        "Other States/Terr.": { alp: 31, lnp: 19, onp: 23, grn: 15, oth: 12 },
      },
      age: {
        "18–34": { alp: 32, lnp: 22, onp: 11, grn: 26, oth: 9 },
        "35–49": { alp: 35, lnp: 18, onp: 25, grn: 14, oth: 8 },
        "50–64": { alp: 26, lnp: 24, onp: 28, grn: 6, oth: 16 },
        "65+": { alp: 26, lnp: 31, onp: 29, grn: 3, oth: 11 },
      },
      education: {
        "High School": { alp: 29, lnp: 19, onp: 29, grn: 12, oth: 11 },
        "Trade Cert.": { alp: 27, lnp: 24, onp: 27, grn: 11, oth: 11 },
        University: { alp: 34, lnp: 28, onp: 11, grn: 16, oth: 11 },
      },
    },
    total: { alp: 30, lnp: 23, onp: 23, grn: 13, oth: 11 },
  },
  "2026-05-26": {
    source: "https://www.foxhedgehog.com.au/news-den/the-daily-telegraph-may-2026-national-voter-sentiment-survey",
    dims: {
      gender: {
        Men: { alp: 30, lnp: 27, onp: 27, grn: 8, oth: 8 },
        Women: { alp: 28, lnp: 23, onp: 27, grn: 13, oth: 9 },
      },
      state: {
        NSW: { alp: 31, lnp: 25, onp: 25, grn: 10, oth: 9 },
        Vic: { alp: 29, lnp: 27, onp: 23, grn: 13, oth: 8 },
        Qld: { alp: 25, lnp: 23, onp: 35, grn: 8, oth: 9 },
        "Other States/Terr.": { alp: 32, lnp: 23, onp: 25, grn: 11, oth: 9 },
      },
      age: {
        "18–34": { alp: 35, lnp: 25, onp: 17, grn: 18, oth: 5 },
        "35–49": { alp: 32, lnp: 19, onp: 27, grn: 11, oth: 11 },
        "50–64": { alp: 25, lnp: 24, onp: 32, grn: 8, oth: 11 },
        "65+": { alp: 23, lnp: 32, onp: 32, grn: 4, oth: 9 },
      },
      education: {
        "High School": { alp: 27, lnp: 26, onp: 30, grn: 8, oth: 9 },
        "Trade Cert.": { alp: 29, lnp: 20, onp: 33, grn: 12, oth: 6 },
        University: { alp: 29, lnp: 31, onp: 17, grn: 14, oth: 9 },
      },
    },
    total: { alp: 29, lnp: 25, onp: 27, grn: 10, oth: 9 },
  },
};

/* Freshwater breakdowns, from each release post's Data-Tables xlsx (the
   Primary Vote crosstab "by CROSSBREAKS"), extracted and verified figure by
   figure (every group sums within rounding of 100.0 and each table's Total
   column matches the poll row; the Oct wave's Men/Women rows reconcile with
   Wikipedia's subpopulation tables too). The Oct 2025 and Jan 2026 data
   tables carry it; from the March 2026 release the workbook prints the
   Primary Vote as national totals only (every other question keeps its
   crosstab), so the March, April and May 2026 waves have no breakdowns to
   file. */
const FRESHWATER_DEMO = {
  "2025-10-20": {
    source: "https://freshwaterstrategy.com/2025/11/10/daily-telegraph-freshwater-strategy-october-polling-data",
    dims: {
      gender: {
        Men: { alp: 36.2, lnp: 32.3, onp: 9.8, grn: 10.7, oth: 10.9 },
        Women: { alp: 30.3, lnp: 29.6, onp: 11.1, grn: 17.2, oth: 11.7 },
      },
      age: {
        "18–35": { alp: 35, lnp: 25.9, onp: 3.6, grn: 27.8, oth: 7.8 },
        "36–53": { alp: 34.8, lnp: 24.5, onp: 11.1, grn: 15.9, oth: 13.6 },
        "54+": { alp: 30.8, lnp: 39.6, onp: 14.4, grn: 3.6, oth: 11.7 },
      },
      income: {
        "Under $75k": { alp: 31.5, lnp: 29.9, onp: 12.2, grn: 13.8, oth: 12.7 },
        "$75–150k": { alp: 35.3, lnp: 32.8, onp: 10.8, grn: 14, oth: 7.2 },
        "$150k or more": { alp: 32.4, lnp: 34.2, onp: 6.3, grn: 14.8, oth: 12.3 },
      },
      state: {
        NSW: { alp: 31.5, lnp: 36.6, onp: 9.9, grn: 13.4, oth: 8.6 },
        Vic: { alp: 31.6, lnp: 29.8, onp: 7.5, grn: 13.3, oth: 17.7 },
        Qld: { alp: 29.8, lnp: 28.6, onp: 18.2, grn: 13.7, oth: 9.7 },
        WA: { alp: 45.4, lnp: 24.5, onp: 6.9, grn: 18, oth: 5.2 },
        SA: { alp: 35.4, lnp: 32.9, onp: 8.5, grn: 17.6, oth: 5.5 },
        Other: { alp: 39.6, lnp: 20.6, onp: 7.5, grn: 9.8, oth: 22.6 },
      },
    },
    total: { alp: 33.2, lnp: 31, onp: 10.5, grn: 14, oth: 11.3 },
  },
  "2026-01-18": {
    source: "https://freshwaterstrategy.com/2026/02/02/news-australia-freshwater-strategy-january-polling-data",
    dims: {
      gender: {
        Men: { alp: 33.3, lnp: 30.4, onp: 18, grn: 8, oth: 10.3 },
        Women: { alp: 32.6, lnp: 25.3, onp: 20.1, grn: 13.6, oth: 8.4 },
      },
      age: {
        "18–34": { alp: 38.7, lnp: 22.9, onp: 10.6, grn: 22.6, oth: 5.2 },
        "35–54": { alp: 35.2, lnp: 25.2, onp: 18.4, grn: 8.9, oth: 12.2 },
        "55+": { alp: 27.4, lnp: 33.2, onp: 25, grn: 4.8, oth: 9.7 },
      },
      income: {
        "Under $75k": { alp: 29.4, lnp: 24.8, onp: 22.9, grn: 11.4, oth: 11.5 },
        "$75–150k": { alp: 33.7, lnp: 28.5, onp: 18.4, grn: 11, oth: 8.4 },
        "$150k or more": { alp: 40.5, lnp: 31.9, onp: 11.5, grn: 9.6, oth: 6.5 },
      },
      state: {
        NSW: { alp: 32.8, lnp: 37.1, onp: 21.2, grn: 5.2, oth: 3.6 },
        Vic: { alp: 31.5, lnp: 26.1, onp: 15.9, grn: 12.2, oth: 14.3 },
        Qld: { alp: 27.5, lnp: 24.3, onp: 24.4, grn: 13.3, oth: 10.6 },
        WA: { alp: 37.8, lnp: 19.4, onp: 9.6, grn: 20.8, oth: 12.4 },
        SA: { alp: 46, lnp: 18.4, onp: 14.2, grn: 12, oth: 9.3 },
        Other: { alp: 34.4, lnp: 24.5, onp: 25.3, grn: 6.4, oth: 9.5 },
      },
    },
    total: { alp: 33, lnp: 27.8, onp: 19, grn: 10.8, oth: 9.3 },
  },
};

/* Roy Morgan finding 10341 ("Voting Intentions by Country of Birth",
   15 Sep 2026): the vote by birth country from one SEVEN-MONTH Single
   Source pool (Jan–Jul 2026, n 26,418) — filed in polls.json as the
   NO_AGG "Roy Morgan (pooled)" wave of 2026-07-31, not the house's
   weekly series. Shares as printed on the release's voting-intention
   charts (every prose-checked figure agrees); the five bar slivers too
   small to read (one per group) are left OUT rather than back-filled
   from the row sum — a complement is computed, not printed. */
const ROYMORGAN_COUNTRY = {
  "2026-07-31": {
    source: "https://www.roymorgan.com/findings/10341-voting-intentions-by-country-of-birth-september-2026",
    country: {
      Australia: { alp: 32, lnp: 21, onp: 25, grn: 13, oth: 6 },
      India: { alp: 43, lnp: 33, onp: 8, grn: 9, oth: 5 },
      "United Kingdom": { alp: 41, lnp: 19, onp: 23, grn: 10, oth: 6 },
      "Mainland China": { alp: 46, lnp: 34, onp: 5, grn: 9, oth: 5 },
      "New Zealand": { alp: 32, lnp: 23, onp: 24, grn: 13, oth: 6 },
      Philippines: { alp: 38, lnp: 30, onp: 16, grn: 11, oth: 2 },
      Vietnam: { alp: 57, lnp: 29, onp: 7, oth: 4 },
      "South Africa": { alp: 19, lnp: 25, onp: 36, grn: 14, oth: 5 },
      Nepal: { alp: 52, lnp: 30, onp: 6, grn: 11 },
      "Sri Lanka": { alp: 49, lnp: 27, onp: 7, grn: 13 },
      Malaysia: { alp: 44, lnp: 29, onp: 10, grn: 10, oth: 5 },
      Italy: { alp: 46, lnp: 18, onp: 30, grn: 5 },
      Pakistan: { alp: 46, lnp: 12, onp: 7, grn: 32 },
    },
    total: { alp: 34, lnp: 22, onp: 24, grn: 13, oth: 7 },
  },
};

/* Newspoll quarterly aggregates, hand-entered from The Australian's
   printed demographic table (see the house note in the header). Keyed by
   the NO_AGG poll row's date; every figure re-read from the paper's Voting
   Intention and Two-party-preferred tables before entry, and Wikipedia's
   subpopulation page carries the same numbers. dims carries the
   first-preference side; tpp the printed ALP two-party share per group
   (row value, 100 minus it the Coalition's). Working-status and religion
   cuts print nowhere else, so they join no common group either. */
const NEWSPOLL_DEMO = {
  "2025-09-11": {
    source: "https://www.theaustralian.com.au/nation/politics/newspoll-quarterly-australias-foreignborn-voters-stay-loyal-to-labor/news-story/a4900d97",
    total: { alp: 36, lnp: 29, grn: 12, onp: 9, oth: 14 },
    dims: {
      gender: {
        Men: { alp: 38, lnp: 29, grn: 10, onp: 9, oth: 14 },
        Women: { alp: 34, lnp: 29, grn: 14, onp: 9, oth: 14 },
      },
      age: {
        "18–34": { alp: 36, lnp: 18, grn: 26, onp: 7, oth: 13 },
        "35–49": { alp: 38, lnp: 26, grn: 14, onp: 9, oth: 13 },
        "50–64": { alp: 36, lnp: 31, grn: 5, onp: 10, oth: 18 },
        "65+": { alp: 34, lnp: 40, grn: 3, onp: 11, oth: 12 },
      },
      // (Male/Female columns verified left-of-centre on the Sept 2025 table)
      state: {
        NSW: { alp: 38, lnp: 25, grn: 13, onp: 10, oth: 14 },
        Vic: { alp: 35, lnp: 30, grn: 15, onp: 7, oth: 13 },
        Qld: { alp: 32, lnp: 33, grn: 12, onp: 10, oth: 13 },
        SA: { alp: 34, lnp: 29, grn: 10, onp: 11, oth: 16 },
        WA: { alp: 39, lnp: 33, grn: 8, onp: 11, oth: 9 },
      },
      education: {
        "No tertiary": { alp: 32, lnp: 32, grn: 13, onp: 11, oth: 12 },
        TAFE: { alp: 37, lnp: 25, grn: 9, onp: 12, oth: 17 },
        University: { alp: 38, lnp: 29, grn: 15, onp: 5, oth: 13 },
      },
      income: {
        "Under $50k": { alp: 39, lnp: 24, grn: 11, onp: 11, oth: 15 },
        "$50–99k": { alp: 34, lnp: 30, grn: 13, onp: 11, oth: 12 },
        "$100–149k": { alp: 35, lnp: 28, grn: 13, onp: 9, oth: 15 },
        "$150k+": { alp: 38, lnp: 29, grn: 13, onp: 7, oth: 13 },
      },
      working: {
        "Full time": { alp: 35, lnp: 30, grn: 13, onp: 9, oth: 13 },
        "Part time": { alp: 36, lnp: 28, grn: 12, onp: 9, oth: 15 },
        Retired: { alp: 35, lnp: 35, grn: 5, onp: 10, oth: 15 },
        Other: { alp: 40, lnp: 23, grn: 17, onp: 8, oth: 12 },
      },
      language: {
        "English only": { alp: 35, lnp: 29, grn: 12, onp: 10, oth: 14 },
        "Other language": { alp: 38, lnp: 28, grn: 16, onp: 5, oth: 13 },
      },
      religion: {
        Christian: { alp: 33, lnp: 34, grn: 8, onp: 11, oth: 14 },
        "No religion": { alp: 43, lnp: 21, grn: 18, onp: 7, oth: 11 },
      },
    },
  },
  "2025-11-20": {
    source: "https://www.theaustralian.com.au/nation/politics/key-groups-shift-from-coalition-to-pauline-hanson-newspoll-finds/news-story/8826bb431e5ebcd98764193fa481603c",
    total: { alp: 36, lnp: 25, grn: 12, onp: 14, oth: 13 },
    dims: {
      gender: {
        Men: { alp: 38, lnp: 26, grn: 10, onp: 14, oth: 12 },
        Women: { alp: 35, lnp: 24, grn: 15, onp: 13, oth: 13 },
      },
      age: {
        "18–34": { alp: 36, lnp: 19, grn: 26, onp: 8, oth: 11 },
        "35–49": { alp: 37, lnp: 25, grn: 13, onp: 13, oth: 12 },
        "50–64": { alp: 39, lnp: 27, grn: 6, onp: 15, oth: 13 },
        "65+": { alp: 33, lnp: 33, grn: 2, onp: 18, oth: 14 },
      },
      state: {
        NSW: { alp: 37, lnp: 24, grn: 12, onp: 14, oth: 13 },
        Vic: { alp: 35, lnp: 26, grn: 16, onp: 11, oth: 12 },
        Qld: { alp: 33, lnp: 27, grn: 10, onp: 18, oth: 12 },
        SA: { alp: 38, lnp: 25, grn: 10, onp: 15, oth: 12 },
        WA: { alp: 37, lnp: 28, grn: 12, onp: 14, oth: 9 },
      },
      education: {
        "No tertiary": { alp: 30, lnp: 26, grn: 14, onp: 20, oth: 10 },
        TAFE: { alp: 35, lnp: 24, grn: 9, onp: 19, oth: 13 },
        University: { alp: 41, lnp: 26, grn: 13, onp: 6, oth: 14 },
      },
      /* Income and the part-time row re-verified against the tables PDF
         (origin.theaustralian.com.au 2025/12/Newspoll.pdf) on 2026-10-09:
         nine figures were column misreads on the first entry and are
         corrected ($50–99k lnp 26→25/oth 11→12, $100–149k alp 35→38/
         onp 11→12/oth 15→11, $150k+ alp 38→39/oth 13→12, Part time
         grn 11→20/onp 17→12/oth 17→13). */
      income: {
        "Under $50k": { alp: 35, lnp: 23, grn: 11, onp: 17, oth: 14 },
        "$50–99k": { alp: 35, lnp: 25, grn: 11, onp: 17, oth: 12 },
        "$100–149k": { alp: 38, lnp: 24, grn: 15, onp: 12, oth: 11 },
        "$150k+": { alp: 39, lnp: 28, grn: 11, onp: 10, oth: 12 },
      },
      working: {
        "Full time": { alp: 38, lnp: 26, grn: 11, onp: 13, oth: 12 },
        "Part time": { alp: 35, lnp: 20, grn: 20, onp: 12, oth: 13 },
        Retired: { alp: 36, lnp: 32, grn: 2, onp: 17, oth: 13 },
        Other: { alp: 30, lnp: 19, grn: 24, onp: 13, oth: 14 },
      },
      language: {
        "English only": { alp: 36, lnp: 26, grn: 12, onp: 14, oth: 12 },
        "Other language": { alp: 40, lnp: 23, grn: 14, onp: 9, oth: 14 },
      },
      religion: {
        Christian: { alp: 32, lnp: 34, grn: 4, onp: 16, oth: 14 },
        "No religion": { alp: 40, lnp: 18, grn: 18, onp: 12, oth: 12 },
      },
    },
  },
  /* January–March 2026 quarter: this release printed no two-party
     table, so no tpp dim rides along. The figures below are re-read
     from the full-tables PDF The Australian links from its article
     (open origin.theaustralian.com.au CDN file newspapers5april… /
     newspoll5april2026.pdf — Pyxis Polling & Insights, online, Jan 12
     – Mar 26, n=4927, state bases 366–1557); its All column is the
     published national total and reconciles with Poll Bludger's prose
     checkpoints (Labor 32, One Nation 25, Coalition 20). Wikipedia
     carries no subpopulation rows for this wave. Housing tenure is
     not yet printed this quarter (debut April–June 2026). */
  "2026-03-26": {
    source: "https://www.theaustralian.com.au/nation/politics/newspoll-one-nation-surges-to-lead-labor-and-coalition-in-queensland/news-story/8e578a11d7ab609c38221490203dfc59",
    total: { alp: 32, lnp: 20, grn: 12, onp: 25, oth: 11 },
    dims: {
      gender: {
        Men: { alp: 34, lnp: 20, grn: 10, onp: 25, oth: 11 },
        Women: { alp: 30, lnp: 19, grn: 14, onp: 26, oth: 11 },
      },
      age: {
        "18–34": { alp: 30, lnp: 14, grn: 26, onp: 19, oth: 11 },
        "35–49": { alp: 33, lnp: 18, grn: 11, onp: 27, oth: 11 },
        "50–64": { alp: 32, lnp: 22, grn: 6, onp: 28, oth: 12 },
        "65+": { alp: 32, lnp: 26, grn: 3, onp: 28, oth: 11 },
      },
      state: {
        NSW: { alp: 31, lnp: 18, grn: 12, onp: 27, oth: 12 },
        Vic: { alp: 32, lnp: 22, grn: 14, onp: 21, oth: 11 },
        Qld: { alp: 27, lnp: 23, grn: 11, onp: 30, oth: 9 },
        SA: { alp: 39, lnp: 13, grn: 12, onp: 27, oth: 9 },
        WA: { alp: 34, lnp: 20, grn: 9, onp: 27, oth: 10 },
      },
      education: {
        "No tertiary": { alp: 27, lnp: 19, grn: 12, onp: 34, oth: 8 },
        TAFE: { alp: 29, lnp: 19, grn: 10, onp: 30, oth: 12 },
        University: { alp: 36, lnp: 21, grn: 13, onp: 17, oth: 13 },
      },
      income: {
        "Under $50k": { alp: 33, lnp: 16, grn: 10, onp: 29, oth: 12 },
        "$50–99k": { alp: 30, lnp: 21, grn: 12, onp: 25, oth: 12 },
        "$100–149k": { alp: 30, lnp: 20, grn: 14, onp: 26, oth: 10 },
        "$150k+": { alp: 35, lnp: 21, grn: 11, onp: 23, oth: 10 },
      },
      working: {
        "Full time": { alp: 33, lnp: 19, grn: 12, onp: 25, oth: 11 },
        "Part time": { alp: 30, lnp: 19, grn: 17, onp: 24, oth: 10 },
        Retired: { alp: 33, lnp: 25, grn: 3, onp: 28, oth: 11 },
        Other: { alp: 27, lnp: 14, grn: 19, onp: 25, oth: 15 },
      },
      language: {
        "English only": { alp: 31, lnp: 20, grn: 12, onp: 26, oth: 11 },
        "Other language": { alp: 35, lnp: 19, grn: 15, onp: 19, oth: 12 },
      },
      religion: {
        Christian: { alp: 28, lnp: 24, grn: 6, onp: 31, oth: 11 },
        "No religion": { alp: 34, lnp: 16, grn: 17, onp: 21, oth: 12 },
      },
    },
  },
  /* April–June 2026 quarter: this release printed no two-party table,
     so no tpp dim rides along. The figures below are re-read from the
     article's own Infogram "Primary vote by …" graphic (its All column
     is the published national total), Wikipedia's subpopulation rows
     agreeing cell for cell. Housing tenure joins the printed dims for
     the first time this quarter. */
  "2026-06-26": {
    source: "https://www.theaustralian.com.au/nation/politics/labor-and-anthony-albanese-on-the-slide-in-three-states-newspoll-finds/news-story/04a868def1628a7d516955cdd4bb5222",
    total: { alp: 31, lnp: 19, grn: 12, onp: 28, oth: 10 },
    dims: {
      gender: {
        Men: { alp: 33, lnp: 19, grn: 10, onp: 28, oth: 10 },
        Women: { alp: 29, lnp: 19, grn: 14, onp: 28, oth: 10 },
      },
      age: {
        "18–34": { alp: 31, lnp: 13, grn: 27, onp: 19, oth: 10 },
        "35–49": { alp: 32, lnp: 17, grn: 12, onp: 30, oth: 9 },
        "50–64": { alp: 30, lnp: 22, grn: 5, onp: 32, oth: 11 },
        "65+": { alp: 32, lnp: 25, grn: 3, onp: 31, oth: 9 },
      },
      state: {
        NSW: { alp: 31, lnp: 16, grn: 13, onp: 29, oth: 11 },
        Vic: { alp: 28, lnp: 21, grn: 14, onp: 25, oth: 12 },
        Qld: { alp: 30, lnp: 22, grn: 9, onp: 32, oth: 7 },
        SA: { alp: 32, lnp: 16, grn: 14, onp: 32, oth: 6 },
        WA: { alp: 32, lnp: 22, grn: 12, onp: 26, oth: 8 },
      },
      education: {
        "No tertiary": { alp: 27, lnp: 20, grn: 12, onp: 33, oth: 8 },
        TAFE: { alp: 28, lnp: 16, grn: 10, onp: 36, oth: 10 },
        University: { alp: 38, lnp: 20, grn: 14, onp: 17, oth: 11 },
      },
      income: {
        "Under $50k": { alp: 33, lnp: 17, grn: 10, onp: 29, oth: 11 },
        "$50–99k": { alp: 31, lnp: 19, grn: 11, onp: 31, oth: 8 },
        "$100–149k": { alp: 30, lnp: 18, grn: 15, onp: 27, oth: 10 },
        "$150k+": { alp: 33, lnp: 20, grn: 12, onp: 26, oth: 9 },
      },
      working: {
        "Full time": { alp: 32, lnp: 18, grn: 11, onp: 29, oth: 10 },
        "Part time": { alp: 30, lnp: 18, grn: 19, onp: 24, oth: 9 },
        Retired: { alp: 32, lnp: 25, grn: 3, onp: 30, oth: 10 },
        Other: { alp: 28, lnp: 14, grn: 20, onp: 27, oth: 11 },
      },
      language: {
        "English only": { alp: 31, lnp: 19, grn: 11, onp: 29, oth: 10 },
        "Other language": { alp: 32, lnp: 19, grn: 16, onp: 21, oth: 12 },
      },
      religion: {
        Christian: { alp: 27, lnp: 24, grn: 5, onp: 35, oth: 9 },
        "No religion": { alp: 35, lnp: 15, grn: 17, onp: 23, oth: 10 },
      },
      // (printed labels "Owned Outright" / "Owned with Mortgage" / "Rented",
      //  tidied onto every other house's housing keys so the groups join)
      housing: {
        "Own outright": { alp: 29, lnp: 26, grn: 6, onp: 29, oth: 10 },
        Mortgage: { alp: 31, lnp: 19, grn: 12, onp: 29, oth: 9 },
        Renting: { alp: 35, lnp: 12, grn: 18, onp: 25, oth: 10 },
      },
    },
  },
  /* July–September 2026 quarter: again no two-party table, so no tpp
     dim rides along. Re-read from the article's own Infogram "Primary
     vote by …" graphic (embed _/8Tko917VckLB6BkkGNwe — the article's
     other three embeds carry Albanese satisfaction, the Albanese–
     Hanson head-to-head and a Queensland seat map). Its All column is
     the published national total, reconciling cell for cell with Poll
     Bludger's prose checkpoints (Qld One Nation 36 / Labor 25, SA
     Labor 32 / One Nation 31, renters Labor 27 / One Nation 30,
     under-$50k One Nation 33; four weekly waves combined, Jul 13 –
     Sep 18, n=4967). Wikipedia does not carry this wave. Housing
     tenure prints for a second quarter, same tidied keys as above. */
  "2026-09-18": {
    source: "https://www.theaustralian.com.au/nation/politics/one-nation-supports-rockets-in-queensland-nsw-and-wa-with-hanson-top-pm-choice-up-north/news-story/076a02f293b8834f3dc00dfa73b637b6",
    total: { alp: 29, lnp: 19, grn: 13, onp: 30, oth: 9 },
    dims: {
      gender: {
        Men: { alp: 31, lnp: 19, grn: 10, onp: 31, oth: 9 },
        Women: { alp: 27, lnp: 19, grn: 16, onp: 29, oth: 9 },
      },
      age: {
        "18–34": { alp: 29, lnp: 12, grn: 28, onp: 23, oth: 8 },
        "35–49": { alp: 27, lnp: 18, grn: 12, onp: 33, oth: 10 },
        "50–64": { alp: 29, lnp: 21, grn: 7, onp: 33, oth: 10 },
        "65+": { alp: 29, lnp: 26, grn: 4, onp: 31, oth: 10 },
      },
      state: {
        NSW: { alp: 30, lnp: 17, grn: 12, onp: 31, oth: 10 },
        Vic: { alp: 29, lnp: 22, grn: 16, onp: 25, oth: 8 },
        Qld: { alp: 25, lnp: 19, grn: 12, onp: 36, oth: 8 },
        SA: { alp: 32, lnp: 13, grn: 14, onp: 31, oth: 10 },
        WA: { alp: 30, lnp: 21, grn: 11, onp: 29, oth: 9 },
      },
      education: {
        "No tertiary": { alp: 25, lnp: 18, grn: 14, onp: 35, oth: 8 },
        TAFE: { alp: 26, lnp: 16, grn: 10, onp: 37, oth: 11 },
        University: { alp: 37, lnp: 22, grn: 14, onp: 17, oth: 10 },
      },
      income: {
        "Under $50k": { alp: 27, lnp: 16, grn: 12, onp: 33, oth: 12 },
        "$50–99k": { alp: 32, lnp: 17, grn: 12, onp: 31, oth: 8 },
        "$100–149k": { alp: 26, lnp: 19, grn: 14, onp: 31, oth: 10 },
        "$150k+": { alp: 31, lnp: 21, grn: 14, onp: 26, oth: 8 },
      },
      working: {
        "Full time": { alp: 30, lnp: 19, grn: 11, onp: 31, oth: 9 },
        "Part time": { alp: 28, lnp: 16, grn: 20, onp: 26, oth: 10 },
        Retired: { alp: 31, lnp: 24, grn: 4, onp: 31, oth: 10 },
        Other: { alp: 23, lnp: 13, grn: 24, onp: 30, oth: 10 },
      },
      language: {
        "English only": { alp: 28, lnp: 18, grn: 13, onp: 31, oth: 10 },
        "Other language": { alp: 34, lnp: 22, grn: 16, onp: 20, oth: 8 },
      },
      religion: {
        Christian: { alp: 25, lnp: 23, grn: 6, onp: 37, oth: 9 },
        "No religion": { alp: 31, lnp: 15, grn: 19, onp: 24, oth: 11 },
      },
      // printed labels identical to the April–June quarter's
      housing: {
        "Own outright": { alp: 30, lnp: 25, grn: 5, onp: 30, oth: 10 },
        Mortgage: { alp: 29, lnp: 20, grn: 13, onp: 30, oth: 8 },
        Renting: { alp: 27, lnp: 11, grn: 21, onp: 30, oth: 11 },
      },
    },
  },
};

/* DemosAU's four 2025–26 national waves before the April-2026 report layout
   the measurer knows (see the house note in the header), hand-entered from
   each wave's own report. July 2025 and 6 Jan 2026 print native text tables
   (the "Don't Know" column dropped – the note under the tables reads
   "Undecided respondents are excluded from party vote share calculations"),
   the printed labels tidied onto the series' keys (Males/Females → Men/
   Women, Uni → University, Rented/Owned → Renting/Own outright, <$45K →
   Under $45k, Regional/Rural → Regional or rural). 21 Jan 2026 prints the
   same breakdowns as images only – measured from a 300-dpi render of the
   report, every printed label matched. 20 Feb 2026's native table prints in
   ALP/ONP/LNP/GRN/Oth order, re-keyed here. */
const DEMOSAU_EARLY_DEMO = {
  "2025-07-06": {
    source: "https://demosau.com/wp-content/uploads/2025/07/DemosAU-Report-Federal-Voting-Intention-July-05-06-2025.pdf",
    total: { alp: 36, lnp: 26, grn: 14, onp: 9, oth: 15 },
    dims: {
      gender: {
        Men: { alp: 36, lnp: 28, grn: 12, onp: 9, oth: 15 },
        Women: { alp: 36, lnp: 25, grn: 15, onp: 9, oth: 15 },
      },
      age: {
        "18–34": { alp: 39, lnp: 16, grn: 31, onp: 4, oth: 10 },
        "35–54": { alp: 36, lnp: 23, grn: 11, onp: 14, oth: 16 },
        "55+": { alp: 35, lnp: 34, grn: 6, onp: 9, oth: 16 },
      },
      education: {
        School: { alp: 34, lnp: 30, grn: 15, onp: 10, oth: 11 },
        TAFE: { alp: 38, lnp: 20, grn: 11, onp: 11, oth: 20 },
        University: { alp: 37, lnp: 28, grn: 15, onp: 6, oth: 14 },
      },
      housing: {
        Renting: { alp: 33, lnp: 19, grn: 21, onp: 10, oth: 17 },
        Mortgage: { alp: 40, lnp: 26, grn: 14, onp: 10, oth: 10 },
        "Own outright": { alp: 34, lnp: 32, grn: 7, onp: 9, oth: 18 },
      },
    },
  },
  "2026-01-06": {
    source: "https://demosau.com/wp-content/uploads/2026/01/DemosAU-Australian-Federal-Poll-Jan-5-6-2026.pdf",
    total: { alp: 29, lnp: 23, grn: 12, onp: 23, oth: 13 },
    dims: {
      gender: {
        Men: { alp: 34, lnp: 24, grn: 7, onp: 24, oth: 11 },
        Women: { alp: 24, lnp: 22, grn: 17, onp: 23, oth: 14 },
      },
      age: {
        "18–34": { alp: 32, lnp: 19, grn: 26, onp: 12, oth: 11 },
        "35–54": { alp: 27, lnp: 22, grn: 8, onp: 26, oth: 17 },
        "55+": { alp: 28, lnp: 26, grn: 6, onp: 28, oth: 12 },
      },
      education: {
        School: { alp: 30, lnp: 24, grn: 10, onp: 25, oth: 11 },
        TAFE: { alp: 24, lnp: 20, grn: 9, onp: 30, oth: 17 },
        University: { alp: 33, lnp: 26, grn: 18, onp: 13, oth: 10 },
      },
      income: {
        "Under $45k": { alp: 28, lnp: 20, grn: 10, onp: 26, oth: 16 },
        "$45–125k": { alp: 30, lnp: 23, grn: 14, onp: 22, oth: 11 },
        "$125k+": { alp: 29, lnp: 36, grn: 14, onp: 18, oth: 3 },
      },
      location: {
        "Inner metro": { alp: 37, lnp: 26, grn: 15, onp: 16, oth: 6 },
        "Outer metro": { alp: 26, lnp: 23, grn: 11, onp: 24, oth: 16 },
        "Regional or rural": { alp: 25, lnp: 20, grn: 11, onp: 32, oth: 12 },
      },
      housing: {
        Renting: { alp: 30, lnp: 16, grn: 17, onp: 20, oth: 17 },
        Mortgage: { alp: 29, lnp: 25, grn: 11, onp: 27, oth: 8 },
        "Own outright": { alp: 28, lnp: 27, grn: 8, onp: 23, oth: 14 },
      },
    },
  },
  "2026-01-21": {
    source: "https://demosau.com/wp-content/uploads/2026/01/DemosAU-Federal-Poll-January-2026-FINAL.pdf",
    read: "measured from the charts",
    total: { alp: 30, lnp: 21, grn: 13, onp: 24, oth: 12 },
    dims: {
      gender: {
        Men: { alp: 31, lnp: 22, grn: 12, onp: 25, oth: 10 },
        Women: { alp: 29, lnp: 20, grn: 14, onp: 24, oth: 13 },
      },
      age: {
        "18–34": { alp: 33, lnp: 16, grn: 29, onp: 13, oth: 9 },
        "35–54": { alp: 31, lnp: 20, grn: 13, onp: 23, oth: 13 },
        "55+": { alp: 28, lnp: 23, grn: 5, onp: 31, oth: 13 },
      },
      education: {
        School: { alp: 28, lnp: 18, grn: 12, onp: 30, oth: 12 },
        TAFE: { alp: 28, lnp: 20, grn: 13, onp: 27, oth: 12 },
        University: { alp: 35, lnp: 26, grn: 14, onp: 14, oth: 11 },
      },
      income: {
        "Under $45k": { alp: 30, lnp: 17, grn: 12, onp: 28, oth: 13 },
        "$45–125k": { alp: 28, lnp: 24, grn: 15, onp: 23, oth: 10 },
        "$125k+": { alp: 38, lnp: 25, grn: 11, onp: 19, oth: 7 },
      },
      location: {
        "Inner metro": { alp: 38, lnp: 19, grn: 17, onp: 17, oth: 9 },
        "Outer metro": { alp: 27, lnp: 23, grn: 14, onp: 25, oth: 11 },
        "Regional or rural": { alp: 24, lnp: 20, grn: 8, onp: 32, oth: 16 },
      },
      housing: {
        Renting: { alp: 30, lnp: 15, grn: 17, onp: 23, oth: 15 },
        Mortgage: { alp: 31, lnp: 21, grn: 15, onp: 23, oth: 10 },
        "Own outright": { alp: 28, lnp: 26, grn: 7, onp: 28, oth: 11 },
      },
    },
  },
  "2026-02-20": {
    source: "https://demosau.com/wp-content/uploads/2026/02/DemosAU-Federal-Poll-Feb-2026.pdf",
    total: { alp: 29, lnp: 21, onp: 28, grn: 12, oth: 10 },
    dims: {
      gender: {
        Men: { alp: 31, lnp: 21, onp: 28, grn: 9, oth: 11 },
        Women: { alp: 27, lnp: 21, onp: 29, grn: 14, oth: 9 },
      },
      age: {
        "18–34": { alp: 30, lnp: 15, onp: 21, grn: 26, oth: 8 },
        "35–54": { alp: 31, lnp: 21, onp: 29, grn: 9, oth: 10 },
        "55+": { alp: 26, lnp: 25, onp: 33, grn: 4, oth: 12 },
      },
      education: {
        School: { alp: 28, lnp: 18, onp: 32, grn: 11, oth: 11 },
        TAFE: { alp: 26, lnp: 21, onp: 32, grn: 10, oth: 11 },
        University: { alp: 34, lnp: 25, onp: 19, grn: 14, oth: 8 },
      },
      housing: {
        Renting: { alp: 28, lnp: 13, onp: 27, grn: 19, oth: 13 },
        Mortgage: { alp: 32, lnp: 22, onp: 29, grn: 10, oth: 7 },
        "Own outright": { alp: 26, lnp: 28, onp: 28, grn: 7, oth: 11 },
      },
      income: {
        "Under $45k": { alp: 27, lnp: 16, onp: 31, grn: 12, oth: 14 },
        "$45–125k": { alp: 30, lnp: 23, onp: 28, grn: 12, oth: 7 },
        "$125k+": { alp: 31, lnp: 36, onp: 19, grn: 8, oth: 6 },
      },
      // printed labels Renter / Mortgage Holder / Home Owner (outright);
      // the Inner-metro row sums to 101 as printed
      location: {
        "Inner metro": { alp: 36, lnp: 26, onp: 18, grn: 14, oth: 7 },
        "Outer metro": { alp: 28, lnp: 21, onp: 30, grn: 11, oth: 10 },
        "Regional or rural": { alp: 22, lnp: 16, onp: 37, grn: 10, oth: 15 },
      },
    },
  },
};

/* The two DemosAU MRP reports print the same breakdowns as native text –
   state by all eight states and territories, five education levels, five
   income brackets ($45K/…/…K tidied onto Under $45k / $45–75k / … / $200k+,
   the last printed ">$200K"), and "Reg & Rur" as the third location row
   (the national series' combined cut, filed there as "Regional or rural").
   Totals are the report's printed national MRP estimates. The March
   report's header reads "Total Sample Size: 8,424" against the poll row's
   recorded 8,484 – the wave's sample comes from the poll row, not here. */
const DEMOSAU_MRP_DEMO = {
  "2025-11-11": {
    source: "https://demosau.com/wp-content/uploads/2025/12/DemosAU-OctNov-Federal-MRP-Report-FINAL-1.pdf",
    total: { alp: 33, lnp: 24, grn: 13, onp: 17, oth: 13 },
    dims: {
      gender: {
        Men: { alp: 33, lnp: 25, grn: 10, onp: 18, oth: 14 },
        Women: { alp: 33, lnp: 22, grn: 16, onp: 16, oth: 13 },
      },
      age: {
        "18–34": { alp: 32, lnp: 19, grn: 26, onp: 11, oth: 12 },
        "35–54": { alp: 34, lnp: 22, grn: 13, onp: 16, oth: 15 },
        "55+": { alp: 33, lnp: 28, grn: 4, onp: 22, oth: 13 },
      },
      education: {
        "Didn't Finish Grade 12": { alp: 32, lnp: 23, grn: 7, onp: 24, oth: 14 },
        "Grade 12": { alp: 33, lnp: 22, grn: 16, onp: 16, oth: 13 },
        TAFE: { alp: 31, lnp: 23, grn: 12, onp: 19, oth: 15 },
        Undergraduate: { alp: 35, lnp: 27, grn: 16, onp: 10, oth: 12 },
        Postgraduate: { alp: 40, lnp: 25, grn: 15, onp: 9, oth: 11 },
      },
      income: {
        "Under $45k": { alp: 32, lnp: 22, grn: 13, onp: 19, oth: 14 },
        "$45–75k": { alp: 33, lnp: 24, grn: 13, onp: 16, oth: 14 },
        "$75–125k": { alp: 34, lnp: 25, grn: 14, onp: 14, oth: 13 },
        "$125–200k": { alp: 35, lnp: 27, grn: 12, onp: 14, oth: 12 },
        "$200k+": { alp: 31, lnp: 32, grn: 8, onp: 18, oth: 11 },
      },
      state: {
        NSW: { alp: 33, lnp: 24, grn: 12, onp: 17, oth: 14 },
        Vic: { alp: 33, lnp: 24, grn: 14, onp: 16, oth: 13 },
        Qld: { alp: 30, lnp: 25, grn: 12, onp: 20, oth: 13 },
        SA: { alp: 36, lnp: 21, grn: 14, onp: 16, oth: 13 },
        WA: { alp: 34, lnp: 23, grn: 12, onp: 19, oth: 12 },
        Tas: { alp: 36, lnp: 18, grn: 13, onp: 17, oth: 16 },
        NT: { alp: 34, lnp: 25, grn: 12, onp: 19, oth: 10 },
        ACT: { alp: 46, lnp: 20, grn: 16, onp: 6, oth: 12 },
      },
      location: {
        "Inner metro": { alp: 38, lnp: 23, grn: 17, onp: 10, oth: 12 },
        "Outer metro": { alp: 35, lnp: 23, grn: 12, onp: 17, oth: 13 },
        "Reg & Rur": { alp: 24, lnp: 26, grn: 9, onp: 24, oth: 17 },
      },
    },
  },
  "2026-03-03": {
    source: "https://demosau.com/wp-content/uploads/2026/03/DemosAU-Federal-MRP-Model-FebMarch-2026-.pdf",
    total: { alp: 29, lnp: 21, grn: 12, onp: 27, oth: 11 },
    dims: {
      gender: {
        Men: { alp: 28, lnp: 22, grn: 10, onp: 29, oth: 11 },
        Women: { alp: 30, lnp: 20, grn: 15, onp: 25, oth: 10 },
      },
      age: {
        "18–34": { alp: 28, lnp: 18, grn: 25, onp: 19, oth: 10 },
        "35–54": { alp: 30, lnp: 19, grn: 12, onp: 27, oth: 12 },
        "55+": { alp: 28, lnp: 24, grn: 5, onp: 33, oth: 10 },
      },
      education: {
        "Didn't Finish Grade 12": { alp: 26, lnp: 18, grn: 7, onp: 38, oth: 11 },
        "Grade 12": { alp: 28, lnp: 21, grn: 16, onp: 25, oth: 10 },
        TAFE: { alp: 27, lnp: 19, grn: 12, onp: 30, oth: 12 },
        Undergraduate: { alp: 32, lnp: 24, grn: 16, onp: 18, oth: 10 },
        Postgraduate: { alp: 35, lnp: 24, grn: 16, onp: 17, oth: 8 },
      },
      income: {
        "Under $45k": { alp: 28, lnp: 19, grn: 13, onp: 29, oth: 11 },
        "$45–75k": { alp: 28, lnp: 21, grn: 14, onp: 27, oth: 10 },
        "$75–125k": { alp: 30, lnp: 21, grn: 12, onp: 26, oth: 11 },
        "$125–200k": { alp: 31, lnp: 24, grn: 11, onp: 24, oth: 10 },
        "$200k+": { alp: 29, lnp: 34, grn: 8, onp: 19, oth: 10 },
      },
      state: {
        NSW: { alp: 29, lnp: 21, grn: 12, onp: 26, oth: 12 },
        Vic: { alp: 28, lnp: 21, grn: 14, onp: 27, oth: 10 },
        Qld: { alp: 25, lnp: 21, grn: 12, onp: 31, oth: 11 },
        SA: { alp: 34, lnp: 18, grn: 12, onp: 27, oth: 9 },
        WA: { alp: 30, lnp: 20, grn: 13, onp: 27, oth: 10 },
        Tas: { alp: 31, lnp: 15, grn: 11, onp: 27, oth: 16 },
        NT: { alp: 31, lnp: 21, grn: 11, onp: 29, oth: 8 },
        ACT: { alp: 42, lnp: 18, grn: 18, onp: 11, oth: 11 },
      },
      location: {
        "Inner metro": { alp: 34, lnp: 22, grn: 17, onp: 17, oth: 10 },
        "Outer metro": { alp: 30, lnp: 20, grn: 12, onp: 28, oth: 10 },
        "Reg & Rur": { alp: 20, lnp: 21, grn: 8, onp: 37, oth: 14 },
      },
    },
  },
};

/* RedBridge/Accent's July 2025 wave (fieldwork 19–30 Jun, published 2 Jul
   in the AFR's "Youthquake: Coalition deserted by younger voters",
   20250701-p5mbja) prints no report PDF; its only breakdowns are the
   article's own Datawrapper table, "Current federal vote intention"
   (embed FexJm/2 beside the two-party-by-group ZUOis/1; the dataset CSVs
   re-fetched and re-read cell by cell). A FOUR-party table – Labor,
   Coalition, Greens, "Others*" (*Other parties and candidates) folding
   One Nation and the independents together (the poll row's onp 9 + ind 12
   = the printed 21, so its all-voters row reconciles exactly). No
   One Nation cut exists anywhere, so onp stays ABSENT from every row –
   the site never reads the fold as a zero share; the pipeline (harmonize,
   demoNorm, gen-data's pooling and rug) keeps the unprinted key null end
   to end, this being the first wave on file with one. The location labels
   are tidied onto the series' keys ("Inner and middle suburbs" → Inner
   metro, "Outer suburbs" → Outer metro, "Provincial cities" → Provincial,
   "Rural communities" → Rural). The 2PP table is not filed – the site's
   demographics are first preference (Roy Morgan's 2PP-only aggregates
   file nothing either). */
const REDBRIDGE_JUL_DEMO = {
  "2025-06-30": {
    source: "https://datawrapper.dwcdn.net/FexJm/2/",
    total: { alp: 37, lnp: 31, grn: 11, oth: 21 },
    dims: {
      age: {
        "18–34": { alp: 40, lnp: 19, grn: 24, oth: 17 },
        "35–49": { alp: 37, lnp: 25, grn: 11, oth: 27 },
        "50–64": { alp: 37, lnp: 34, grn: 5, oth: 24 },
        "65+": { alp: 36, lnp: 44, grn: 1, oth: 18 },
      },
      gender: {
        Women: { alp: 36, lnp: 30, grn: 13, oth: 21 },
        Men: { alp: 39, lnp: 32, grn: 8, oth: 21 },
      },
      location: {
        "Inner metro": { alp: 43, lnp: 29, grn: 11, oth: 17 },
        "Outer metro": { alp: 39, lnp: 30, grn: 12, oth: 19 },
        Provincial: { alp: 34, lnp: 33, grn: 11, oth: 22 },
        Rural: { alp: 32, lnp: 32, grn: 8, oth: 28 },
      },
    },
  },
};

/* RedBridge/Accent's October 2025 report (its own PDF, predating the
   extractor's cached-text series): Tables 1 and 2, "Federal vote intention
   for the House of Representatives", hand-entered cell by cell from the
   fetched PDF, the party columns re-keyed (Labor, Coalition, Greens,
   One Nation, Other parties and candidates; the LABOR 2PP column not
   read) and the labels tidied onto the series' keys. Employment, occupation,
   household income (weekly), financial stress, religion, birthplace and
   language cuts print nowhere else in the house's series – kept as their
   own dims, like Newspoll's working/religion tables. */
const REDBRIDGE_OCT_DEMO = {
  "2025-10-07": {
    source: "https://6b72024e-077a-44e2-88f5-dc1a0ed81099.usrfiles.com/ugd/b86980_bfa36468f2104c90ba79a9bc66da0ab5.pdf",
    total: { alp: 34, lnp: 29, grn: 11, onp: 14, oth: 12 },
    dims: {
      generation: {
        "Gen Z": { alp: 37, lnp: 16, grn: 29, onp: 6, oth: 12 },
        Millennials: { alp: 37, lnp: 24, grn: 13, onp: 13, oth: 13 },
        "Gen X": { alp: 36, lnp: 31, grn: 7, onp: 15, oth: 11 },
        Boomers: { alp: 31, lnp: 37, grn: 4, onp: 17, oth: 11 },
      },
      gender: {
        Women: { alp: 32, lnp: 30, grn: 13, onp: 13, oth: 12 },
        Men: { alp: 37, lnp: 28, grn: 8, onp: 15, oth: 12 },
      },
      location: {
        "Inner metro": { alp: 39, lnp: 29, grn: 13, onp: 9, oth: 10 },
        "Outer metro": { alp: 36, lnp: 27, grn: 13, onp: 13, oth: 11 },
        Provincial: { alp: 33, lnp: 31, grn: 10, onp: 15, oth: 11 },
        Rural: { alp: 29, lnp: 30, grn: 6, onp: 20, oth: 15 },
      },
      education: {
        "Below Year 12": { alp: 26, lnp: 36, grn: 5, onp: 22, oth: 11 },
        "Year 12": { alp: 33, lnp: 26, grn: 19, onp: 11, oth: 11 },
        "TAFE or trade": { alp: 35, lnp: 26, grn: 8, onp: 18, oth: 13 },
        University: { alp: 39, lnp: 32, grn: 12, onp: 6, oth: 11 },
      },
      religion: {
        Protestant: { alp: 28, lnp: 40, grn: 3, onp: 19, oth: 10 },
        Catholic: { alp: 35, lnp: 33, grn: 6, onp: 15, oth: 11 },
        "Other religions": { alp: 34, lnp: 24, grn: 15, onp: 9, oth: 18 },
        "No religion": { alp: 39, lnp: 22, grn: 16, onp: 12, oth: 11 },
      },
      language: {
        "English only": { alp: 34, lnp: 29, grn: 11, onp: 14, oth: 12 },
        "Other language": { alp: 45, lnp: 23, grn: 15, onp: 9, oth: 8 },
      },
      // birthplace, filed under Roy Morgan's country-of-birth dim key
      country: {
        Australia: { alp: 34, lnp: 27, grn: 12, onp: 15, oth: 12 },
        "Another country": { alp: 39, lnp: 35, grn: 6, onp: 10, oth: 10 },
      },
      working: {
        "Working full time": { alp: 36, lnp: 30, grn: 8, onp: 14, oth: 12 },
        "Working part time": { alp: 34, lnp: 22, grn: 19, onp: 11, oth: 14 },
        "Not working": { alp: 40, lnp: 17, grn: 16, onp: 16, oth: 11 },
        Retired: { alp: 31, lnp: 38, grn: 4, onp: 16, oth: 11 },
      },
      occupation: {
        "Professional and managerial": { alp: 38, lnp: 32, grn: 8, onp: 9, oth: 13 },
        "Sales, services and clerical": { alp: 34, lnp: 23, grn: 18, onp: 15, oth: 10 },
        "Blue collar": { alp: 32, lnp: 27, grn: 9, onp: 16, oth: 16 },
      },
      income: {
        "$3,000+ a week": { alp: 36, lnp: 32, grn: 11, onp: 10, oth: 11 },
        "$2,000–2,999 a week": { alp: 36, lnp: 30, grn: 11, onp: 12, oth: 11 },
        "$1,000–1,999 a week": { alp: 34, lnp: 28, grn: 8, onp: 18, oth: 12 },
        "Under $1,000 a week": { alp: 36, lnp: 24, grn: 12, onp: 14, oth: 14 },
        "Prefer not to say": { alp: 32, lnp: 31, grn: 14, onp: 11, oth: 12 },
      },
      stress: {
        "A great deal of stress": { alp: 26, lnp: 23, grn: 17, onp: 19, oth: 15 },
        "Some stress": { alp: 36, lnp: 26, grn: 12, onp: 13, oth: 13 },
        "Not much stress": { alp: 35, lnp: 34, grn: 7, onp: 13, oth: 11 },
        "No stress at all": { alp: 41, lnp: 35, grn: 6, onp: 12, oth: 6 },
      },
      // printed labels Owned outright / Owned with a mortgage, tidied
      housing: {
        "Own outright": { alp: 32, lnp: 36, grn: 5, onp: 16, oth: 11 },
        Mortgage: { alp: 37, lnp: 31, grn: 8, onp: 13, oth: 11 },
        "Renting and other": { alp: 36, lnp: 18, grn: 21, onp: 12, oth: 13 },
      },
    },
  },
};

/* RedBridge/Accent's November 2025 wave (fieldwork 7–13 Nov, AFR 16 Nov):
   the one 2025 wave with NO Accent report – the house's monthly project
   pages run October 2025 then December 2025, and no
   afr…-november-2025-federal-poll slug ever existed (probed). So the
   figures it published live only in Phillip Coorey's AFR piece: its text
   quotes two cells, and the generational vote-intention table that rode
   the piece (no fetchable dataset, unlike the June wave's FexJm) survives
   verbatim in Wikipedia's next-election subpopulation chapter, whose four
   generation tables carry the wave cited to the AFR article – the Gen X
   row cites Kos Samaras's post too (x.com/KosSamaras/status/
   1990511966826455110, "Dog whistling your way to 24%" – protected,
   unreadable). Entered cell by cell from Wikipedia's transcription and
   verified against every unblocked check: the AFR piece's own text,
   re-read whole, says "the Coalition's primary support among Gen Z voters
   is 10 per cent and 23 per cent among Millennials" – both cells match the
   table exactly; every printed group row sums to 100 on its own keys; and
   total() below sits within the gate of the poll row's published primaries.
   Gen X is the one row printing a party split (Lib 22 + Nat 4 = the 26
   filed combined); Independents print nowhere – the table's IND column is
   N/A everywhere and they fold into Others, matching the poll row's
   ind 11 / oth null. "Baby boomers" tidied to the series' Boomers. The
   table's 2PP cells aren't filed – the site's demographics are first
   preference. */
const REDBRIDGE_NOV_DEMO = {
  "2025-11-13": {
    source: "https://www.afr.com/politics/federal/one-nation-closing-in-on-coalition-as-ley-s-rating-hits-record-low-20251116-p5nfq2",
    total: { alp: 38, lnp: 24, grn: 9, onp: 18, oth: 11 },
    dims: {
      generation: {
        "Gen Z": { alp: 51, lnp: 10, grn: 24, onp: 5, oth: 10 },
        Millennials: { alp: 34, lnp: 23, grn: 11, onp: 18, oth: 14 },
        "Gen X": { alp: 38, lnp: 26, grn: 6, onp: 20, oth: 10 },
        Boomers: { alp: 34, lnp: 30, grn: 3, onp: 24, oth: 9 },
      },
    },
  },
};

/* YouGov's Climate Council MRP (national report, 17 Nov 2025): the
   first-preference table's "Don't know" base (n=253) is already excluded
   from the printed shares; Independent and Another Party fold into oth,
   as the poll row (oth 10) has it. Age, gender and region cuts only. */
const YOUGOV_MRP_DEMO = {
  "2025-11-17": {
    source: "https://www.climatecouncil.org.au/wp-content/uploads/2025/11/ClimateCouncil_EPA_MRP_Report_201125_national.pdf",
    total: { alp: 34, lnp: 26, onp: 18, grn: 12, oth: 10 },
    dims: {
      gender: {
        Men: { alp: 37, lnp: 26, onp: 18, grn: 10, oth: 9 },
        Women: { alp: 32, lnp: 25, onp: 18, grn: 14, oth: 11 },
      },
      age: {
        "18–24": { alp: 42, lnp: 11, onp: 4, grn: 32, oth: 11 },
        "25–34": { alp: 35, lnp: 17, onp: 16, grn: 20, oth: 12 },
        "35–49": { alp: 36, lnp: 24, onp: 16, grn: 13, oth: 11 },
        "50–64": { alp: 32, lnp: 30, onp: 21, grn: 7, oth: 10 },
        "65+": { alp: 31, lnp: 36, onp: 23, grn: 3, oth: 7 },
      },
      location: {
        "Inner metro": { alp: 40, lnp: 24, onp: 9, grn: 17, oth: 10 },
        "Outer metro": { alp: 35, lnp: 24, onp: 21, grn: 12, oth: 8 },
        Provincial: { alp: 33, lnp: 27, onp: 21, grn: 10, oth: 9 },
        Rural: { alp: 26, lnp: 30, onp: 23, grn: 9, oth: 12 },
      },
    },
  },
};

/* YouGov's Australia Institute wave (poll of 19 Mar 2026): the summary
   PDF's Tables 1–2 print a "Don't know" row (8% nationally) the poll row
   has excluded, so the shares are filed renormalised off Don't know
   (largest remainder per column – the printed figures rounded to whole
   percents first, Independent folded into oth with Other). The state
   table's "Other" column is Tas/ACT/NT together, filed "ACT/NT/Tas" so
   the common state set's merge joins it. */
const YOUGOV_TAI_DEMO = {
  "2026-03-19": {
    source: "https://cdn.australiainstitute.org.au/2026/03/18023552/Aus-Institute-Mar26-poll-summary-20032026-votingintention_GAS.pdf",
    total: { alp: 28, lnp: 21, grn: 13, onp: 26, oth: 12 },
    dims: {
      gender: {
        Men: { alp: 33, lnp: 19, grn: 12, onp: 26, oth: 10 },
        Women: { alp: 26, lnp: 22, grn: 14, onp: 27, oth: 11 },
      },
      age: {
        "18–24": { alp: 30, lnp: 14, grn: 38, onp: 6, oth: 12 },
        "25–34": { alp: 28, lnp: 12, grn: 25, onp: 18, oth: 17 },
        "35–49": { alp: 29, lnp: 17, grn: 11, onp: 29, oth: 14 },
        "50–64": { alp: 30, lnp: 25, grn: 9, onp: 28, oth: 8 },
        "65+": { alp: 26, lnp: 29, grn: 4, onp: 34, oth: 7 },
      },
      state: {
        NSW: { alp: 31, lnp: 18, grn: 14, onp: 26, oth: 11 },
        Vic: { alp: 29, lnp: 22, grn: 16, onp: 21, oth: 12 },
        Qld: { alp: 21, lnp: 27, grn: 10, onp: 33, oth: 9 },
        WA: { alp: 31, lnp: 20, grn: 10, onp: 29, oth: 10 },
        SA: { alp: 24, lnp: 10, grn: 19, onp: 29, oth: 18 },
        "ACT/NT/Tas": { alp: 36, lnp: 16, grn: 10, onp: 18, oth: 20 },
      },
    },
  },
};

function redbridgeCache(date) {
  const dir = path.join(ROOT, ".build", "redbridge-src");
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!f.endsWith(".json")) continue;
    let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
    const txt = path.join(dir, f.replace(/\.json$/, ".txt"));
    if (j.date === date && fs.existsSync(txt)) return txt;
  }
  return null;
}

// ---- assemble -----------------------------------------------------------------
const refresh = process.argv.includes("--refresh");
const polls = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8")).polls;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { waves: [], skipped: [] };
const key = (w) => w.pollster + "|" + w.date;
const have = new Map((prev.waves || []).map((w) => [key(w), w]));
const waves = [], skipped = [], added = [], pending = [];
const push = (w) => { waves.push(w); if (!have.has(key(w))) added.push(key(w)); };
// not readable this run: retried next run, and a wave already on file stays
const pend = (k, why) => { pending.push(`${k}: ${why}`); if (have.has(k)) waves.push(have.get(k)); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "demographics-"));
const essWaves = essentialWaves(fs.readFileSync(path.join(ROOT, "data", "essential-report.csv"), "utf8"));
// the hand-entered waves below (DEMOSAU_EARLY_DEMO…YOUGOV_TAI_DEMO) cover
// these rows themselves – the readers never get a second pass at them
const HAND_KEYS = new Set(Object.keys(YOUGOV_TAI_DEMO).map((d) => "YouGov|" + d)
  .concat(Object.keys(DEMOSAU_EARLY_DEMO).map((d) => "DemosAU|" + d)));
try {
  const candidates = polls.filter((p) => !HAND_KEYS.has(key(p))
    && ((["YouGov", "DemosAU", "RedBridge/Accent"].includes(p.pollster) && p.date >= FIRST)
    || FIRST_EXTRA.has(key(p))
    || (p.pollster === "Essential" && p.date >= FIRST_ESS)));
  for (const p of candidates) {
    const k = key(p);
    if (KNOWN_SKIP[k]) { skipped.push({ pollster: p.pollster, date: p.date, reason: KNOWN_SKIP[k] }); continue; }
    if (!refresh && have.has(k)) { waves.push(have.get(k)); continue; }
    const base = { pollster: p.pollster, date: p.date, dateStart: p.dateStart ?? null, dateEnd: p.dateEnd ?? p.date ?? null,
                   sample: p.sample ?? null, article: p.url ?? null };
    try {
      if (p.pollster === "YouGov") {
        const src = youGovSource(p.date);
        if (src.pending) { pend(k, src.pending); continue; }
        const t = await youGovCrosstab(src.ids);
        if (!t) { pend(k, "no crosstab among the wave's charts (none published? add it to KNOWN_SKIP once checked)"); continue; }
        const d = youGovDims(t);
        const bad = dimsProblem(d.dims) || totalProblem(d.total, p);
        if (bad) { pend(k, `the crosstab didn't read cleanly – ${bad}`); continue; }
        push({ ...base, source: t.source, read: "published table", dims: d.dims, total: d.total });
        console.log(`${k}: ${Object.entries(d.dims).map(([dm, g]) => `${dm}(${Object.keys(g).join("/")})`).join(" ")}`);
      } else if (p.pollster === "DemosAU") {
        const rep = await demosauReport(p, tmp);
        if (!rep) { pend(k, "the report PDF isn't reachable yet"); continue; }
        const charts = measureCharts(rep.file, Object.keys(DEMOS_DIM));
        const dims = {}; let fit = 0, bad = null;
        for (const [name, c] of Object.entries(charts)) {
          if (c.error) continue;
          if (c.maxOffInteger > FIT_LIMIT) { bad = `the ${name} chart read ${c.maxOffInteger} off whole percentages – a layout the measurer doesn't know?`; break; }
          fit = Math.max(fit, c.maxOffInteger);
          const dim = DEMOS_DIM[name];
          dims[dim] = Object.fromEntries(Object.entries(c.rows).map(([label, sh]) => [demosLabel(dim, label), sh]));
        }
        bad ||= Object.keys(dims).length ? dimsProblem(dims) : "no breakdown chart (Gender, Age, Education, …) found in the report";
        if (bad) { pend(k, bad); continue; }
        push({ ...base, source: rep.url, read: "measured from the charts", dims, fit });
        console.log(`${k}: ${Object.keys(dims).join(", ")} (fit ${fit})`);
      } else if (p.pollster === "Essential") {
        const dte = essentialMatch(essWaves, p);
        if (!dte) { pend(k, "no Primary Vote+ wave in essential-report.csv within five days of this row"); continue; }
        const w = essWaves.get(dte);
        const bad = dimsProblem(w.dims) || totalProblem(w.total, p);
        if (bad) { pend(k, `the Primary Vote+ table didn't read cleanly – ${bad}`); continue; }
        push({ ...base, source: p.releaseUrl ?? p.url ?? null, read: "published table", dims: w.dims, total: w.total });
        console.log(`${k}: ${Object.entries(w.dims).map(([dm, g]) => `${dm}(${Object.keys(g).join("/")})`).join(" ")}`);
      } else {
        const txt = redbridgeCache(p.date);
        if (!txt) { pend(k, "no RedBridge extractor cache for this wave yet"); continue; }
        const t = redbridgeTable(fs.readFileSync(txt, "utf8"));
        const bad = !t ? "no first-preference table by group the reader knows in the report" : dimsProblem(t.dims) || totalProblem(t.total, p);
        if (bad) { pend(k, bad); continue; }
        push({ ...base, source: p.releaseUrl || p.url || null, read: "published table", dims: t.dims, ...(t.total ? { total: t.total } : {}) });
        console.log(`${k}: ${Object.keys(t.dims).join(", ")} (columns ${t.columns.join(",")})`);
      }
    } catch (e) {
      pend(k, String(e.message || e).slice(0, 160));
    }
  }
  // Roy Morgan: hand-entered breakdowns (ROYMORGAN_DEMO) — most releases
  // carry none, so waves with none are left alone, not pending
  for (const [date, h] of Object.entries(ROYMORGAN_DEMO)) {
    const k = "Roy Morgan|" + date;
    if (!refresh && have.has(k)) { waves.push(have.get(k)); continue; }
    const p = polls.find((x) => x.pollster === "Roy Morgan" && x.date === date);
    if (!p) { pend(k, "no Roy Morgan poll row for this wave's date yet"); continue; }
    const bad = dimsProblem(h.dims) || totalProblem(h.total, p);
    if (bad) { pend(k, `the hand-entered table failed the gate – ${bad}`); continue; }
    push({ pollster: "Roy Morgan", date, dateStart: p.dateStart ?? null, dateEnd: p.dateEnd ?? p.date ?? null,
           sample: p.sample ?? null, article: p.url ?? null, source: h.source, read: "published table", dims: h.dims,
           ...(h.total ? { total: h.total } : {}) });
    console.log(`${k}: ${Object.entries(h.dims).map(([dm, g]) => `${dm}(${Object.keys(g).join("/")})`).join(" ")}`);
  }
  // Fox & Hedgehog and Freshwater: hand-entered breakdowns (FOXHEDGEHOG_DEMO,
  // FRESHWATER_DEMO) — releases without a crosstab file nothing, so waves
  // with none are left alone, not pending
  for (const [house, table] of [["Fox & Hedgehog", FOXHEDGEHOG_DEMO], ["Freshwater", FRESHWATER_DEMO]]) {
    for (const [date, h] of Object.entries(table)) {
      const k = house + "|" + date;
      if (!refresh && have.has(k)) { waves.push(have.get(k)); continue; }
      const p = polls.find((x) => x.pollster === house && x.date === date);
      if (!p) { pend(k, `no ${house} poll row for this wave's date yet`); continue; }
      const bad = dimsProblem(h.dims) || totalProblem(h.total, p);
      if (bad) { pend(k, `the hand-entered table failed the gate – ${bad}`); continue; }
      push({ pollster: house, date, dateStart: p.dateStart ?? null, dateEnd: p.dateEnd ?? p.date ?? null,
             sample: p.sample ?? null, article: p.url ?? null, source: h.source, read: "published table", dims: h.dims,
             ...(h.total ? { total: h.total } : {}) });
      console.log(`${k}: ${Object.entries(h.dims).map(([dm, g]) => `${dm}(${Object.keys(g).join("/")})`).join(" ")}`);
    }
  }
  // Roy Morgan birth-country table (ROYMORGAN_COUNTRY, the "Roy Morgan
  // (pooled)" NO_AGG wave) — one special release, the same hand-entered
  // treatment as a state-table wave
  for (const [date, h] of Object.entries(ROYMORGAN_COUNTRY)) {
    const k = "Roy Morgan (pooled)|" + date;
    if (!refresh && have.has(k)) { waves.push(have.get(k)); continue; }
    const p = polls.find((x) => x.pollster === "Roy Morgan (pooled)" && x.date === date);
    if (!p) { pend(k, "no Roy Morgan (pooled) poll row for this wave's date yet"); continue; }
    const dims = { country: h.country };
    const bad = dimsProblem(dims) || totalProblem(h.total, p);
    if (bad) { pend(k, `the hand-entered country table failed the gate – ${bad}`); continue; }
    push({ pollster: "Roy Morgan (pooled)", date, dateStart: p.dateStart ?? null, dateEnd: p.dateEnd ?? p.date ?? null,
           sample: p.sample ?? null, article: p.url ?? null, source: h.source, read: "published table", dims, total: h.total });
    console.log(`${k}: country(${Object.keys(h.country).join("/")})`);
  }
  // Newspoll quarterly aggregates — the "Newspoll (pooled)" NO_AGG waves.
  // Not in HOUSES: releases without a breakdown file nothing. Two figure
  // sources merge here, hand-entered keys winning: NEWSPOLL_DEMO below, and
  // the machine layer data/newspoll-quarterly.json written and re-verified
  // against source every run by extract-newspoll-quarterly.mjs (which also
  // files the pooled polls.json rows a NEW quarter lands on).
  const npqFile = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "newspoll-quarterly.json"), "utf8")); }
    catch { return null; }
  })();
  const npFileDemo = {};
  for (const w of npqFile?.waves ?? [])
    if (w?.date && w.dims && !(w.date in NEWSPOLL_DEMO))
      npFileDemo[w.date] = { dims: w.dims, total: w.total, source: w.article ?? w.source ?? null,
                             read: w.kind === "infogram" ? "Infogram chart" : "tables pdf" };
  for (const [date, h] of Object.entries({ ...npFileDemo, ...NEWSPOLL_DEMO })) {
    const k = "Newspoll (pooled)|" + date;
    if (!refresh && have.has(k)) { waves.push(have.get(k)); continue; }
    const p = polls.find((x) => x.pollster === "Newspoll (pooled)" && x.date === date);
    if (!p) { pend(k, "no Newspoll (pooled) poll row for this wave's date yet"); continue; }
    const bad = dimsProblem(h.dims) || totalProblem(h.total, p);
    if (bad) { pend(k, `${date in NEWSPOLL_DEMO ? "the hand-entered" : "the quarterly-agent's"} table failed the gate – ${bad}`); continue; }
    push({ pollster: "Newspoll (pooled)", date, dateStart: p.dateStart ?? null, dateEnd: p.dateEnd ?? p.date ?? null,
           sample: p.sample ?? null, article: p.url ?? null, source: h.source, read: h.read ?? "published table", dims: h.dims, total: h.total });
    console.log(`${k}: ${Object.entries(h.dims).map(([dm, g]) => `${dm}(${Object.keys(g).join("/")})`).join(" ")}`);
  }
  // The hand-entered waves of reader-covered houses (DEMOSAU_EARLY_DEMO…
  // YOUGOV_TAI_DEMO): one-off layouts and MRP reports the readers have never
  // learnt. HAND_KEYS above keeps the candidate loop off them.
  for (const [house, table] of [["DemosAU", DEMOSAU_EARLY_DEMO], ["DemosAU (MRP)", DEMOSAU_MRP_DEMO],
    ["RedBridge/Accent", REDBRIDGE_JUL_DEMO], ["RedBridge/Accent", REDBRIDGE_OCT_DEMO],
    ["RedBridge/Accent", REDBRIDGE_NOV_DEMO],
    ["YouGov (MRP)", YOUGOV_MRP_DEMO], ["YouGov", YOUGOV_TAI_DEMO]]) {
    for (const [date, h] of Object.entries(table)) {
      const k = house + "|" + date;
      if (!refresh && have.has(k)) { waves.push(have.get(k)); continue; }
      const p = polls.find((x) => x.pollster === house && x.date === date);
      if (!p) { pend(k, `no ${house} poll row for this wave's date yet`); continue; }
      const bad = dimsProblem(h.dims) || totalProblem(h.total, p);
      if (bad) { pend(k, `the hand-entered table failed the gate – ${bad}`); continue; }
      push({ pollster: house, date, dateStart: p.dateStart ?? null, dateEnd: p.dateEnd ?? p.date ?? null,
             sample: p.sample ?? null, article: p.url ?? null, source: h.source, read: h.read || "published table", dims: h.dims,
             ...(h.total ? { total: h.total } : {}) });
      console.log(`${k}: ${Object.entries(h.dims).map(([dm, g]) => `${dm}(${Object.keys(g).join("/")})`).join(" ")}`);
    }
  }
  // Resolve: one fetch carries every month; rebuilt whole each run, or kept
  // whole from the file when the fetch or any month fails the gate
  try {
    const rs = resolveWaves(await resolveData());
    for (const w of rs) {
      const bad = dimsProblem(w.dims);
      if (bad) throw new Error(`the ${w.date} series didn't read cleanly – ${bad}`);
    }
    if (!rs.length) throw new Error("the interactive carried no age, gender or state series for this term");
    for (const w of rs) push(w);
  } catch (e) {
    pending.push(`Resolve: ${String(e.message || e).slice(0, 160)}`);
    for (const w of prev.waves || []) if (w.pollster === "Resolve") waves.push(w);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
waves.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.pollster.localeCompare(b.pollster)));
skipped.sort((a, b) => (a.date < b.date ? -1 : 1));

// stale: a wave of a house read here, older than STALE_DAYS, still not on file
const daysAgo = (d) => (Date.now() - Date.parse(d + "T00:00:00Z")) / 864e5;
const onFile = new Set(waves.map(key)), skippedKeys = new Set(skipped.map(key));
const stale = polls.filter((p) => HOUSES.includes(p.pollster) && p.date >= FIRST && daysAgo(p.date) > STALE_DAYS
  && !onFile.has(key(p)) && !skippedKeys.has(key(p))
  && !(p.pollster === "Resolve" && waves.some((w) => w.pollster === "Resolve" && Math.abs(daysAgo(w.date) - daysAgo(p.date)) <= RESOLVE_MATCH_DAYS)))
  .map(key);

// dropped: a group printed in two waves running, missing from the house's
// newest wave on file (see the header), unless KNOWN_DROP records it
const dropped = [];
for (const house of HOUSES) {
  const hw = waves.filter((w) => w.pollster === house);
  const newest = hw[hw.length - 1];
  if (!newest) continue;
  const has = (w, dim, g) => !!(w.dims && w.dims[dim] && w.dims[dim][g]);
  const seen = new Set(hw.flatMap((w) => Object.entries(w.dims || {}).flatMap(([dim, gs]) => Object.keys(gs).map((g) => dim + "|" + g))));
  for (const dg of seen) {
    const [dim, g] = dg.split("|");
    if (has(newest, dim, g)) continue;
    const last = hw.map((w) => has(w, dim, g)).lastIndexOf(true);
    if (last < 1 || !has(hw[last - 1], dim, g)) continue;   // a one-off, never a series
    const k = `${house}|${dim}|${g}|${hw[last + 1].date}`;
    if (!KNOWN_DROP[k]) dropped.push(k);
  }
}

// watch – the hand-entered houses get no stale/dropped alarms, so their
// release shapes are watched for directly (demo-watch.mjs; the "reminders"
// paragraph in the header). A reminder fails the weekly crosstabs run until
// the wave is hand-entered, or KNOWN_SKIP records it as checked by hand.
const rmDir = path.join(ROOT, ".build", "roymorgan-src");
const reminders = watchReminders({
  polls, waves, knownSkip: KNOWN_SKIP,
  rmReleaseFor: (id) => {
    if (!fs.existsSync(rmDir)) return null;
    const f = fs.readdirSync(rmDir).find((x) => x.startsWith(`release-${id}-`) && x.endsWith(".json"));
    if (!f) return null;
    try { return JSON.parse(fs.readFileSync(path.join(rmDir, f), "utf8")); } catch { return null; }
  },
  now: new Date(),
});

const doc = {
  _about: "First-preference vote by group, per poll wave, as each pollster groups it: dims[gender|age|generation|education|income|state|location|housing|language|…][group][party] (% of that group). Party keys alp, lnp, onp, grn, oth (independents and all smaller parties). income is per-house only (YouGov household, DemosAU personal; no common brackets) – read for the All-polls demographics facet, never pooled. Built by .build/demographics.mjs – see its header for sources. `skipped` lists waves checked by hand and found to carry no breakdowns.",
  waves,
  skipped,
};
const next = JSON.stringify(doc, null, 1) + "\n";
const changed = !fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== next;
if (changed) { fs.writeFileSync(OUT + ".tmp", next); fs.renameSync(OUT + ".tmp", OUT); }
for (const m of pending) console.log("pending", m);
for (const k of dropped) console.log("dropped", k, "– missing from the newest wave; fix the reader, or record it in KNOWN_DROP once checked");
for (const r of reminders) console.log("reminder", r);
const rsAdded = added.filter((k) => k.startsWith("Resolve|")).length;
console.log("DEMO_STATUS " + JSON.stringify({ changed,
  added: added.filter((k) => !k.startsWith("Resolve|")).concat(rsAdded ? [`Resolve (${rsAdded} months)`] : []),
  pending: pending.map((m) => m.split(":")[0]), stale, dropped, reminders, skipped: skipped.map(key) }));
