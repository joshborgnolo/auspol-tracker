/* flows.mjs – the ONE definition of the preference-flow constants, imported
   by validate.mjs (2PP inversion check) and gen-data.mjs (synthetic-2PP
   diagnostic), so the gate and the diagnostic can never drift apart.

   Measured from the AEC 2025 TPP flow download (Event 31496,
   HouseTppFlowByStateByPartyDownload-31496.txt) by .build/aec-tpp-flows.py —
   every formal ballot redistributed ALP v Coalition in all 150 seats (state
   rows summed, "First Preferences" aggregates skipped):
     grn 0.8819 (1,666,851 v 223,126)   onp→ALP 0.2550 (252,917 v 738,897)
     ind 0.6715 (756,196 v 369,855)     ind+oth lumped 0.5455 (1,268,209 v 1,056,696)

   Which cut: the AEC publishes one election's flows three ways — the TCP WEB
   table (HouseStateTcpFlow-31496-NAT.htm, 79.93/25.39; rows sum across ALL
   final-two destinations incl. IND/GRN/ON/KAP/CA), the TCP DOWNLOAD with
   destinations collapsed to majors (86.83/27.10/48.49 — the previously
   shipped set, parsed by .build/aec-flows.py), and this TPP cut. The TPP cut
   is what Roy Morgan's "2025 election" 2PP tracks (MAE 0.43 v 0.94 for the
   TCP-renorm set over 38 waves) and it won the flow-validate.mjs competition
   on 2026-08-29 (mean |house bias| 0.774 v 1.008), so it is now the shipped
   anchor. The full provenance table and the three-cuts explanation live in
   the project skill auto-skill-aec-preference-flow-constants; re-derive from
   the SAME cut so constants stay comparable across refreshes. */
export const FLOW = Object.freeze({ grn: 0.8819, onp: 0.2550, oth: 0.5455 });


/* FP_ON – the Labor v One Nation table, as the share of each group's voters
   that reaches Labor, with its own ± range in FP_ON_BAND. No count of that
   final pairing has ever run nationally, so unlike FLOW this table is built,
   not counted. Revised 2026-10-11 from .315/.89/.53 (bands .025/.03/.03);
   the Coalition cell then to .30 the same day, towards Bonham's .29;
   the working, with sources, is on /flows-explained/.

     Coalition .30 ± .03. 2025 Senate ballots put One Nation ahead of Labor
       on 74.7% of Coalition ballots (75.5 without the ACT, where it ran no
       group). The two 2026 lower-house readings of LIBERAL voters sit lower:
       South Australia ~66 (Kevin Bonham's estimate from the published
       distributions; ECSA's flows by first preference are due late 2026) and
       Secret Harbour in the high 60s (Antony Green's early-voting-centre
       count, 70.2, read against the full distribution). Neither holds
       Nationals voters (Farrer: 69 to One Nation against the Liberals' 59;
       Hunter's 82.9 was a Nationals flow), and SA and WA are the big states
       least inclined to One Nation: together 2-4 points towards One Nation
       nationally. The counts' One Nation-strong seats, and the 2025 cards
       that put Labor first in seven urban seats, pull back. Net 30-32 to
       Labor on this reading; Kevin Bonham's independent estimate is 29 (71%
       to One Nation). Set at 30 on 2026-10-11 (was .315): with the evidence
       genuinely split, meeting an independent estimate partway beats
       either alone. The band (27-33) takes in both and SA's raw ~34.
     Greens .91 ± .025. 88.2 reached Labor against the Coalition in 2025,
       and every like-for-like comparison has Greens voters favouring Labor
       more against One Nation: Senate ballots +4.6, Green's SA three-way
       tables (same ballots) +2.5, Secret Harbour's 90.0 against WA's 87.1.
     Others .55 ± .04. 54.5 reached Labor against the Coalition in 2025.
       Independents (48% of the pool) favour Labor more against One Nation,
       right-wing minor parties less; Bonham takes the two as cancelling
       (54.7). SA's independents (55.9) and the respondent splits (RedBridge
       57-70, Newspoll 62) sit higher. The widest band of the three.

   FP_ON_BAND is a range, not a sampling interval. gen-data stacks it
   linearly at each poll's primaries, and quotes the figure with that range
   and the polls' own sampling margin added in quadrature. */
export const FP_ON = Object.freeze({ lnp: 0.30, grn: 0.91, oth: 0.55 });
export const FP_ON_BAND = Object.freeze({ lnp: 0.03, grn: 0.025, oth: 0.04 });

/* Three-cornered contests — the term the formula below was missing.
   Points of national 2PP that leak from the Coalition to Labor in seats where
   BOTH Coalition partners run: one of them is excluded first and its
   preferences distribute, and most but not all of them stay inside the
   Coalition. The same AEC file the flows above come from counts it, in the
   two rows a Coalition-v-Labor formula otherwise has no use for:

     Liberal        11,176 ballots transferred — 12.47% to Labor (1,394)
     The Nationals  51,243 ballots transferred — 18.97% to Labor (9,723)
                                                 ────────────────
                                                 11,117 to Labor

   over a formal vote of 15,490,236 = 0.072 points. Kevin Bonham's aggregate
   carries the same term at 0.07, derived the same way.

   It has to be a CONSTANT and not a rate on any primary column: the leak
   depends on how many seats are three-cornered, which is a seat-level fact a
   national poll's primaries cannot carry. Re-derive it at the next election
   from that election's own LP/NP transfer rows — the number moves with the
   Nationals' seat footprint, not with the vote. */
export const FLOW_3CNR = 0.072;

/* The table FLOW is anchored to, in the words display copy should use – the
   flow-drift panel's note interpolates this so a re-anchor at a future
   election can never leave the page describing yesterday's table. */
export const FLOW_TABLE = "the AEC's 2025-election flow table (TPP cut)";

/* Implied ALP 2PP from a poll's primary columns: every formal minor-party
   vote ends with ALP or L·NP under full preferential voting, so one ALP-side
   constant per published bucket carries the whole redistribution. */
export const impliedAlp2pp = (p) => {
  if (p.alp == null) return null;
  const n0 = (v) => (v == null ? 0 : v);
  return p.alp
    + FLOW.grn * n0(p.grn)
    + FLOW.onp * n0(p.onp)
    + FLOW.oth * (n0(p.ind) + n0(p.oth))
    + FLOW_3CNR;
};
/* The same reading through another jurisdiction's table — /vic/ passes the
   2022 Victorian flows (.build/vic/to-main-schema.mjs) as `flow`, with its
   own three-cornered term. Same formula, so the two pages can never read
   primaries differently except by their constants. */
export const makeImpliedAlp2pp = (flow, threeCorner = 0) => (p) => {
  if (p.alp == null) return null;
  const n0 = (v) => (v == null ? 0 : v);
  return p.alp
    + flow.grn * n0(p.grn)
    + flow.onp * n0(p.onp)
    + flow.oth * (n0(p.ind) + n0(p.oth))
    + threeCorner;
};

/* FLOW_ERAS – the pre-1987 counterpart of FLOW. F2F Morgan Gallup waves of
   the 1943–87 era (the aeforecasts mirror import) publish NO 2PP – Morgan
   did not publish a national two-party figure then – so the rows carry an
   IMPLIED 2PP (tppEra key → constants), derived by last-election flows the
   way Kevin Bonham's Wonk Central piece
   (kevinbonham.blogspot.com/2015/09/wonk-central-track-record-of-last.html)
   applies them to modern polls:

   1. Each era reads a poll's primaries through the flow constants measured
      at the election that OPENED the cycle (LEF: constants of election E
      serve the polls of the E→E+1 cycle, never E's own).
   2. The constants were calibrated per election against that election's
      published national 2PP† (AEC/published: 1943 58.2, 1946 54.1, 1949
      49.0, 1951 49.3, 1954 50.7, 1955 45.8, 1958 45.9, 1961 50.5, 1963
      47.4, 1966 43.1, 1969 50.2, 1972 52.7, 1974 51.7, 1975 44.3, 1977
      45.4, 1980 49.6, 1983 53.23, 1984 51.77, 1987 50.83, ALP share)
      using national primaries from the pappubahry election-statistics
      dataset (the 1943–58 additions from the election articles' results
      tables, Psephos-derived, UAP/Country folded into the Coalition the
      way Liberal/Country already were): f_oth pinned at 0.45 (the stable
      solved value for the genuine minor/independent remainder in the
      DLP-era fit), the era's headline minor party (DLP to 1975, Democrats
      from 1977) solved per election, DLP pinned at 0.27 in the Democrat
      era (its vote was ≤1.4% and collapsing – the pooled DLP-era
      estimate). Before the DLP there is no headline minor to solve, so
      the 1943–1954 sets solve f_oth itself, the one free constant, so
      each set reproduces its own election exactly. The solved values
      swing (0.27 to 0.82) because "others" was 2–7% of the vote and a
      0.1-point rounding in the 2PP moves the flow by up to 0.05.
      † The AEC did no full distribution of preferences before 1984, so
        every pre-1984 figure here is an estimate (the 1949–1980 series is
        the Parliamentary Library's); the AEC lists none before 1949, and
        the 1943/1946 figures are the published Mackerras estimates,
        which carry wider tolerance with them.
   3. Two structural breaks get explicit assumptions instead of a solved
      flow. The 1977 Democrat debut (Bonham's "completely obvious at the
      time" case): no prior Democrat flow exists, so the 1975 set carries
      dem=0.50. And the 1955 Labor split: solved against 1955 itself, the
      new Anti-Communist Labor/DLP flow comes out at 0.002 (all but every
      preference to the Coalition), a flow that put the 1957–58 waves,
      where the DLP polls 6–11%, 2–3 points too low for Labor. The 1955 set
      therefore carries the pooled DLP-era 0.27 (the Democrat-era pin);
      it misses 1955 itself by +1.38 but lands 1958 exactly.

   The bt field is the right-edge backtest (same convention as FLOW_LEF):
   the set's constants applied to the CLOSING election's actual primaries
   vs that election's official 2PP, in ALP points. Bonham's test of
   last-election flows starts in 1955 and reports an AVERAGE miss of about
   0.6 for 1955-80 (not a bound); every set but two misses by less than
   that; the two that miss by more – 1943's
   others were a 12% independent vote plus splinter Labor, which broke
   nothing like 1946's, and 1951's 0.82 overshoots 1954 – and the bt
   field records each miss as it stands; the cyclePollBases notes quote
   it to the reader instead of the budget line. The implied
   figure is tagged per row with `tppEra` (the opening election year, i.e.
   the key below), and validate.mjs inverts era rows against THESE
   constants instead of the 2025 set. */
export const FLOW_ERAS = Object.freeze({
  1943: { oth: 0.4213, bt: -1.59 },
  1946: { oth: 0.6611, bt: -0.53 },
  1949: { oth: 0.8032, bt: -0.04 },
  1951: { oth: 0.8227, bt: 1.31 },
  1954: { oth: 0.2669, bt: -0.48 },
  1955: { dlp: 0.27, oth: 0.45, bt: 0 },
  1958: { dlp: 0.2698, oth: 0.45, bt: 0.33 },
  1961: { dlp: 0.2319, oth: 0.45, bt: 0.27 },
  1963: { dlp: 0.1952, oth: 0.45, bt: -0.47 },
  1966: { dlp: 0.2594, oth: 0.45, bt: -0.02 },
  1969: { dlp: 0.2633, oth: 0.45, bt: -0.07 },
  1972: { dlp: 0.2765, oth: 0.45, bt: -0.04 },
  1974: { dlp: 0.3032, oth: 0.45, bt: 0.2 },
  1975: { dlp: 0.1551, dem: 0.5, oth: 0.45, bt: -0.2 },
  1977: { dlp: 0.27, dem: 0.5033, oth: 0.45, bt: -0.35 },
  1980: { dlp: 0.27, dem: 0.5571, oth: 0.45, bt: -0.14 },
  1983: { dlp: 0.27, dem: 0.584, oth: 0.45, bt: -0.24 },
  1984: { dlp: 0.27, dem: 0.6287, oth: 0.45, bt: -0.24 },
});

/* Implied ALP 2PP from an ERA row's primaries. Era rows itemise the
   Democrats and DLP out of oth (dem/dlp row fields, OTH column stays raw),
   so each headline minor runs through its own calibrated flow. */
export const impliedEraAlp2pp = (era, p) => {
  if (p.alp == null) return null;
  const n0 = (v) => (v == null ? 0 : v);
  return p.alp
    + n0(era.dem) * n0(p.dem)
    + n0(era.dlp) * n0(p.dlp)
    + era.oth * n0(p.oth);
};

/* FLOW_LEF – one flow table per election from 1987 to 2022, so every past
   term's two-party line on Past cycles is read the way the current term's
   implied 2PP is: each poll's primaries through the flows counted at the
   election that OPENED the term (last-election flows – the only table an
   observer inside the term could have used, and the method Kevin Bonham's
   Wonk Central track record audits). The 2025 table is FLOW above; the
   1961–84 terms keep FLOW_ERAS. Derived by .build/aec-flow-history.py from
   the AEC's own counts, cached in .build/aec-flow-src/:
     2004–2022  AEC two-party-preferred flow by state by party – every formal
                ballot in every seat redistributed ALP v Coalition (the TPP
                cut FLOW ships for 2025).
     1996–2001  AEC official election statistics, "Two Candidate Preferred
                Preference Flow Result", division by division (tcp-<year>.json.gz,
                aec-tcp-history.py), classic seats only (final two Labor or
                Country Labor v a Coalition party: 142, 144 and 145 seats;
                Country Labor's nine 2001 seats were missing until
                2026-10-21) – counted flows over nine seats in ten, since no
                all-seat TPP cut exists.
     1987–1993  the AEC published no flow by party before 1996 (each seat's
                full distribution exists from 1984, so flows by party can
                be ESTIMATED - .build/estimate-state-flows.py's federal_hist
                - but the 1990-93 poll rows give one combined minor-party
                vote, so a single rate is all they can take). The table is
                the lumped minor-party flow the official result implies:
                (ALP 2PP − ALP primary) ÷ (100 − ALP − Coalition), exact for
                the opening election by construction.
   Buckets are the poll columns they are applied to: grn every Greens party,
   onp One Nation, oth every other non-major ballot (independents in). share
   is the election's own national primary for each bucket – the weights for
   a poll that folds a bucket into its oth column. anchor is what the table
   leaves between the election's own primaries and its official 2PP (the
   three-cornered leak in the TPP cut, like FLOW_3CNR; non-classic seats in
   the classic cut); added back so month 0 of every term is the count.
   Right-edge backtest – each table on the NEXT election's primaries against
   its official 2PP, ALP points (the test Bonham runs): 1990 −0.13,
   1993 +0.13, 1996 +0.77, 1998 +0.05, 2001 −0.14, 2004 +0.40, 2007 +0.02,
   2010 +0.31, 2013 −1.04, 2016 −0.23, 2019 +0.83, 2022 −0.97, 2025 −0.38;
   mean |error| 0.42. Every row is aec-flow-history.py's output, recorded in
   data/flow-lef.json and held to it by test-flow-lef.mjs (until 2026-10-21
   the 1987-93 rows still carried rates from the elections table's earlier
   one-decimal primaries: 1987 0.5882 for 0.6043). These are NOT Bonham's
   figures: he applied
   party-by-party flows estimated from each seat's distribution, where the
   1987-93 tables here are one lumped rate (the site's 1990-93 poll rows
   carry no Democrats/Greens split to apply party flows to). Where both
   are known they agree in sign; 2013's size matches (1.0), 1990's does
   not (0.13 here, 1.1 his). */
export const FLOW_LEF = Object.freeze({
  1987: { minor: 0.6043, anchor: 0, bt: -0.13 },
  1990: { minor: 0.6117, anchor: 0, bt: 0.13 },
  1993: { minor: 0.5994, anchor: 0, bt: 0.77 },
  1996: { grn: 0.6710, oth: 0.5088, anchor: 0.213, bt: 0.05, share: { grn: 1.74, onp: 0.00, oth: 12.27 } },
  1998: { grn: 0.7328, onp: 0.4634, oth: 0.5523, anchor: -0.016, bt: -0.14, share: { grn: 2.14, onp: 8.43, oth: 9.82 } },
  2001: { grn: 0.7483, onp: 0.4413, oth: 0.5699, anchor: -0.032, bt: 0.40, share: { grn: 4.96, onp: 4.34, oth: 9.85 } },
  2004: { grn: 0.8079, onp: 0.4360, oth: 0.4429, anchor: 0.069, bt: 0.02, share: { grn: 7.19, onp: 1.19, oth: 7.28 } },
  2007: { grn: 0.7969, onp: 0.4700, oth: 0.4453, anchor: 0.111, bt: 0.31, share: { grn: 7.79, onp: 0.26, oth: 6.46 } },
  2010: { grn: 0.7884, onp: 0.4521, oth: 0.4162, anchor: 0.090, bt: -1.04, share: { grn: 11.76, onp: 0.22, oth: 6.42 } },
  2013: { grn: 0.8303, onp: 0.4490, oth: 0.4671, anchor: 0.144, bt: -0.23, share: { grn: 8.65, onp: 0.17, oth: 12.25 } },
  2016: { grn: 0.8194, onp: 0.4953, oth: 0.4922, anchor: 0.133, bt: 0.83, share: { grn: 10.23, onp: 1.29, oth: 11.70 } },
  2019: { grn: 0.8221, onp: 0.3478, oth: 0.4607, anchor: 0.099, bt: -0.97, share: { grn: 10.40, onp: 3.08, oth: 11.74 } },
  2022: { grn: 0.8566, onp: 0.3570, oth: 0.5002, anchor: 0.031, bt: -0.38, share: { grn: 12.25, onp: 4.96, oth: 14.50 } },
});

/* Implied ALP 2PP of a past poll row under its term's FLOW_LEF table.
   - A primary set that doesn't total 100 (±2) is rescaled to 100 first:
     every such set in the cycle history carries a declared basis
     (cyclePollBases – undecided left out without a rebase, or an era table
     whose minor columns overlap), and proportional rescaling is the one
     reading that privileges no column, as the undecided-inclusive 2PP pair
     is rebased elsewhere on the site.
   - A lumped table reads every non-major point at its one flow.
   - Otherwise each itemised column reads at its own flow; the oth column
     carries whatever the poll did not itemise, at the election's own
     share-weighted mix of those buckets; and a party the opening count
     never met (One Nation in the 1996 table) reads at that count's 'others'
     flow – what an observer inside the term would have had to assume. */
export const impliedLefAlp2pp = (t, p) => {
  if (!t || p.alp == null || p.lnp == null) return null;
  const COLS = ["alp", "lnp", "grn", "onp", "oth"];
  const sum = COLS.reduce((s, k) => s + (p[k] ?? 0), 0);
  const k = p.oth != null && Math.abs(sum - 100) > 2 ? 100 / sum : 1;
  const v = (c) => (p[c] == null ? null : p[c] * k);
  const alp = v("alp"), lnp = v("lnp");
  const anchor = t.anchor || 0;
  if (t.minor != null) return alp + t.minor * (100 - alp - lnp) + anchor;
  const grn = v("grn"), onp = v("onp");
  const oth = p.oth != null ? v("oth") : Math.max(0, 100 - alp - lnp - (grn ?? 0) - (onp ?? 0));
  const f = (b) => (t[b] != null && t.share[b] >= 0.05 ? t[b] : t.oth);
  const folded = ["oth", ...(grn == null ? ["grn"] : []), ...(onp == null ? ["onp"] : [])];
  const w = folded.reduce((s, b) => s + t.share[b], 0);
  const fOth = w ? folded.reduce((s, b) => s + f(b) * t.share[b], 0) / w : t.oth;
  return alp + (grn != null ? f("grn") * grn : 0) + (onp != null ? f("onp") * onp : 0) + fOth * oth + anchor;
};

/* FLOW_HISTORY – the federal flow-by-party DISPLAY series, every election
   1996–2025: the share of each bucket's ballots that ended with Labor at
   that election, in per cent, from the AEC's full preference-distribution
   tables by party (the classic cut 1996–2001, the TPP cut since 2004):
   FLOW_LEF's own cells (data/flow-lef.json, test-flow-lef.mjs), One Nation
   null below 1% of the primary vote. This is the
   series the Info glossary's flow chart and the /flows-explained/ in-article
   chart both draw; it is display history, NOT an estimator input (FLOW_LEF
   and FLOW are – changing them is an estimator change; changing this is
   copy). null = the bucket went immeasurable that election (One Nation
   barely contested, or a lumped table before 1996 – the display starts
   1996, where the itemised cut begins). */
export const FLOW_HISTORY = Object.freeze({
  years: [1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025],
  grn: [67.1, 73.3, 74.8, 80.8, 79.7, 78.8, 83.0, 81.9, 82.2, 85.7, 88.2],
  onp: [null, 46.3, 44.1, 43.6, null, null, null, 49.5, 34.8, 35.7, 25.5],
  oth: [50.9, 55.2, 57.0, 44.3, 44.5, 41.6, 46.7, 49.2, 46.1, 50.0, 54.5],
});

/* FLOW_HISTORY_SENATE – the Senate's own display series, the four elections
   since group voting tickets were abolished (the GVT era ran party tickets,
   so no per-ballot CSVs exist before it and no flows can be computed). No
   official Senate flow table exists, so these are counted from the AEC's
   ballot-level formal-preferences zips by senate-atl/analyse_atl_flows.py
   and pinned to its counts (.build/aec-flow-src/senate-atl/counts.json,
   test-senate-atl-flows.mjs recomputes every figure from them). Above-the-
   line papers only: a figure is the share of the family's papers naming at
   least one major party that named Labor first; each *Nei array is the one
   the House series lacks – the share of the family's papers naming neither
   major ("named neither major", NOT "exhausted": many of those ballots went
   on to elect a crossbench senator). null = the family had no above-the-line
   tickets in that state that election (One Nation in the ACT all four, the
   NT until 2025). Display history, NOT an estimator input. */
export const FLOW_HISTORY_SENATE = Object.freeze({
  years: [2016, 2019, 2022, 2025],
  grn: [86.9, 86.3, 89.2, 91.0], grnNei: [15.3, 12.9, 10.3, 9.5],
  onp: [47.1, 32.9, 37.0, 19.9], onpNei: [46.6, 36.1, 44.8, 24.4],
  oth: [49.3, 43.5, 53.5, 50.6], othNei: [35.5, 35.7, 37.3, 30.7],
  states: Object.freeze({
    nsw: { label: "New South Wales",           short: "NSW",
           grn: [89.3, 88.6, 88.3, 90.2], grnNei: [16.1, 16.9, 10.6, 12.4],
           onp: [48.4, 36.2, 38.2, 18.0], onpNei: [46.3, 41.8, 47.5, 28.1],
           oth: [43.9, 45.1, 55.1, 43.1], othNei: [36.7, 40.3, 38.7, 35.6] },
    vic: { label: "Victoria",                  short: "Vic",
           grn: [88.6, 88.9, 92.1, 93.4], grnNei: [16.1, 12.4, 9.2, 8.4],
           onp: [49.8, 37.5, 36.6, 21.4], onpNei: [51.2, 41.0, 48.1, 23.0],
           oth: [55.3, 47.1, 54.9, 58.3], othNei: [39.0, 37.6, 39.8, 29.6] },
    qld: { label: "Queensland",                short: "Qld",
           grn: [87.6, 84.6, 87.2, 92.2], grnNei: [18.9, 14.0, 13.1, 10.4],
           onp: [46.2, 29.1, 35.5, 21.8], onpNei: [49.1, 35.1, 41.9, 26.3],
           oth: [49.5, 38.2, 49.7, 47.5], othNei: [41.9, 36.4, 42.1, 36.6] },
    wa:  { label: "Western Australia",         short: "WA",
           grn: [76.9, 79.6, 89.5, 86.9], grnNei: [11.8, 9.6, 9.5, 6.8],
           onp: [39.2, 27.9, 43.0, 17.5], onpNei: [35.5, 23.6, 46.6, 17.0],
           oth: [39.1, 34.4, 52.2, 44.7], othNei: [28.1, 26.0, 35.7, 25.3] },
    sa:  { label: "South Australia",           short: "SA",
           grn: [86.4, 84.2, 86.4, 88.8], grnNei: [12.8, 8.6, 8.8, 6.6],
           onp: [54.4, 40.3, 30.0, 18.9], onpNei: [41.7, 29.8, 38.1, 19.1],
           oth: [55.3, 45.5, 45.5, 44.7], othNei: [21.0, 24.3, 27.6, 22.5] },
    tas: { label: "Tasmania",                  short: "Tas",
           grn: [86.7, 84.6, 90.5, 92.8], grnNei: [13.7, 4.4, 7.6, 5.6],
           onp: [57.2, 37.6, 48.6, 26.6], onpNei: [35.3, 18.7, 35.1, 18.1],
           oth: [59.1, 45.5, 56.3, 59.6], othNei: [26.7, 13.7, 22.3, 19.8] },
    act: { label: "Australian Capital Territory", short: "ACT",
           grn: [90.0, 88.5, 92.2, 92.9], grnNei: [1.8, 0.7, 4.8, 0.6],
           onp: [null, null, null, null], onpNei: [null, null, null, null],
           oth: [53.4, 48.4, 71.1, 76.1], othNei: [9.2, 2.5, 9.0, 0.8] },
    nt:  { label: "Northern Territory",        short: "NT",
           grn: [76.9, 80.6, 84.1, 84.5], grnNei: [1.6, 3.0, 1.8, 1.6],
           onp: [null, null, null, 20.0], onpNei: [null, null, null, 3.6],
           oth: [36.9, 45.0, 39.5, 61.2], othNei: [3.2, 8.3, 4.7, 4.2] },
  }),
});

/* FLOW_HISTORY_NSW_LC – the one state UPPER house the explainer can show
   (NSW keeps no group tickets since 1999, so its Legislative Council prints
   a per-ballot record; no other state upper house publishes one). Counted
   from the NSW Electoral Commission's ballot-level preference-data zips by
   nswec-lc-flow-src/analyse_nsw_lc.py, pinned to its counts
   (.build/nswec-lc-flow-src/counts.json; test-nsw-lc-atl-flows.mjs
   recomputes every figure from them). Same estimand as the Senate series:
   above-the-line ballots only, a figure the share of the family's papers
   naming at least one major party that named Labor first, each *Nei array
   the share naming neither major ("named neither", NOT "exhausted" – those
   ballots mostly stay with minor groups). Most papers carry just one "1"
   (oneOnly: 84% of ATL ballots in 2015, 72% in 2019, 62% in 2023 – the
   explainer's caption quotes them, so they are pinned here too). One
   Nation's 2015 is null, never zero: it ran no LC group that year. Display
   history, NOT an estimator input. */
export const FLOW_HISTORY_NSW_LC = Object.freeze({
  years: [2015, 2019, 2023],
  grn: [90.9, 91.7, 94.5], grnNei: [74.9, 64.1, 44.8],
  onp: [null, 33.3, 20.1], onpNei: [null, 89.6, 82.8],
  oth: [41.4, 54.5, 60.7], othNei: [87.2, 81.5, 77.1],
  oneOnly: [84.4, 71.6, 62.3],
});
