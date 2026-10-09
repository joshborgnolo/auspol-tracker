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
                 .mjs); from the April 2026 report (earlier reports used
                 another layout without them). Its Income chart (personal
                 income) is read to the same facet-only end as YouGov's.
     RedBridge – the "First preference vote intention" table in the report
                 text extract-redbridge.mjs caches (.build/redbridge-src/),
                 from February 2026 (earlier reports printed it as figures):
                 generation, gender, location, education, home ownership and
                 vote softness.
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
                 unpredictable, so stale/dropped checks would misfire.
                 harmonize joins only NSW/Vic/Qld (no Tas or ACT/NT cut →
                 no Rest of Australia).
   Newspoll   – the quarterly aggregate Newspoll publishes to The
                 Australian: one reading per release pooled from about ten
                 weeks of waves (filed in polls.json as NO_AGG "Newspoll
                 (pooled)" rows), printing first-preference and two-party
                 by gender, age bands 18–34/35–49/50–64/65+, the five
                 mainland states, education No tertiary / TAFE / University,
                 household income, working status, language at home and
                 religion (the April–June 2026 quarter adds housing tenure:
                 owned outright / owned with mortgage / rented),
                 hand-entered in NEWSPOLL_DEMO below and verified
                 against the printed table (the same figures sit on
                 Wikipedia's subpopulation page and reconcile). "No
                 tertiary" spans Year-12-or-less AND TAFE-or-trade voters,
                 so no common education group holds every wave's school row
                 – harmonize drops the dim unless the wave prints a school
                 row of its own. Newspoll cuts no Tas/ACT/NT, so its states
                 join NSW/Vic/Qld/SA/WA only. Not in HOUSES.
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

   Usage: node .build/demographics.mjs [--refresh]
     --refresh  re-read every wave, not just the new ones
   Last line: DEMO_STATUS {"changed":…,"added":[…],"pending":[…],"stale":[…],"dropped":[…],"skipped":[…]} */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, youGovSource, youGovCrosstab, demosauReport, resolveData } from "./crosstab-sources.mjs";
import { youGovDims, DEMOS_DIM, demosLabel, redbridgeTable, resolveWaves, essentialWaves, essentialMatch, dimsProblem, totalProblem } from "./crosstab-parse.mjs";
import { measureCharts, FIT_LIMIT } from "./demosau-charts.mjs";

const OUT = path.join(ROOT, "data", "demographics.json");
const FIRST = "2026-02-01";            // no house published these breakdowns earlier this term
const FIRST_ESS = "2025-05-03";        // Essential's CSV visuals run since 2023 – read from the term's start
const HOUSES = ["YouGov", "DemosAU", "RedBridge/Accent", "Resolve", "Essential"];
const STALE_DAYS = 16;                 // a week to publish, then a weekly retry, then someone looks
const RESOLVE_MATCH_DAYS = 4;          // the interactive can date a month a day or two off the poll row

const KNOWN_SKIP = {
  "DemosAU|2026-02-20": "the February report predates the Gender, Age and Education charts (an older layout)",
  "YouGov|2026-03-19": "an Australia Institute poll – no crosstab published",
  "YouGov|2026-06-16": "the wave's article carries no crosstab",
  "RedBridge/Accent|2026-03-27": "filed from the AFR article – Accent's March report was never cached",
};

/* Groups a house really stopped printing, checked by hand: "house|dim|group|
   date of the first wave without it" → why. See `dropped` in the header. */
const KNOWN_DROP = {
  "YouGov|age|50–64|2026-03-24": "YouGov printed 50–64 and 65+ only in Feb–Mar 2026; from 24 Mar it cut by generation instead, and from Jun its oldest band is 50+",
  "YouGov|age|65+|2026-03-24": "YouGov printed 50–64 and 65+ only in Feb–Mar 2026; from 24 Mar it cut by generation instead, and from Jun its oldest band is 50+",
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
      income: {
        "Under $50k": { alp: 35, lnp: 23, grn: 11, onp: 17, oth: 14 },
        "$50–99k": { alp: 35, lnp: 26, grn: 11, onp: 17, oth: 11 },
        "$100–149k": { alp: 35, lnp: 24, grn: 15, onp: 11, oth: 15 },
        "$150k+": { alp: 38, lnp: 28, grn: 11, onp: 10, oth: 13 },
      },
      working: {
        "Full time": { alp: 38, lnp: 26, grn: 11, onp: 13, oth: 12 },
        "Part time": { alp: 35, lnp: 20, grn: 11, onp: 17, oth: 17 },
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
try {
  const candidates = polls.filter((p) => (["YouGov", "DemosAU", "RedBridge/Accent"].includes(p.pollster) && p.date >= FIRST)
    || (p.pollster === "Essential" && p.date >= FIRST_ESS));
  for (const p of candidates) {
    const k = key(p);
    if (KNOWN_SKIP[k]) { skipped.push({ pollster: p.pollster, date: p.date, reason: KNOWN_SKIP[k] }); continue; }
    if (!refresh && have.has(k)) { waves.push(have.get(k)); continue; }
    const base = { pollster: p.pollster, date: p.date, dateStart: p.dateStart ?? null, sample: p.sample ?? null,
                   article: p.url ?? null };
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
    push({ pollster: "Roy Morgan", date, dateStart: p.dateStart ?? null, sample: p.sample ?? null,
           article: p.url ?? null, source: h.source, read: "published table", dims: h.dims,
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
      push({ pollster: house, date, dateStart: p.dateStart ?? null, sample: p.sample ?? null,
             article: p.url ?? null, source: h.source, read: "published table", dims: h.dims,
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
    push({ pollster: "Roy Morgan (pooled)", date, dateStart: p.dateStart ?? null, sample: p.sample ?? null,
           article: p.url ?? null, source: h.source, read: "published table", dims, total: h.total });
    console.log(`${k}: country(${Object.keys(h.country).join("/")})`);
  }
  // Newspoll quarterly aggregates (NEWSPOLL_DEMO) — the "Newspoll (pooled)"
  // NO_AGG waves. Not in HOUSES: releases without a breakdown file nothing.
  for (const [date, h] of Object.entries(NEWSPOLL_DEMO)) {
    const k = "Newspoll (pooled)|" + date;
    if (!refresh && have.has(k)) { waves.push(have.get(k)); continue; }
    const p = polls.find((x) => x.pollster === "Newspoll (pooled)" && x.date === date);
    if (!p) { pend(k, "no Newspoll (pooled) poll row for this wave's date yet"); continue; }
    const bad = dimsProblem(h.dims) || totalProblem(h.total, p);
    if (bad) { pend(k, `the hand-entered table failed the gate – ${bad}`); continue; }
    push({ pollster: "Newspoll (pooled)", date, dateStart: p.dateStart ?? null, sample: p.sample ?? null,
           article: p.url ?? null, source: h.source, read: "published table", dims: h.dims, total: h.total });
    console.log(`${k}: ${Object.entries(h.dims).map(([dm, g]) => `${dm}(${Object.keys(g).join("/")})`).join(" ")}`);
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
const rsAdded = added.filter((k) => k.startsWith("Resolve|")).length;
console.log("DEMO_STATUS " + JSON.stringify({ changed,
  added: added.filter((k) => !k.startsWith("Resolve|")).concat(rsAdded ? [`Resolve (${rsAdded} months)`] : []),
  pending: pending.map((m) => m.split(":")[0]), stale, dropped, skipped: skipped.map(key) }));
