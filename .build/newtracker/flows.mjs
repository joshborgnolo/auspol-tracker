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

/* The same three flows at DISPLAY precision, taken from the ballots rather
   than from the constants above. They are not the same operation: 0.5455 is
   the right 4dp rounding of the counted 0.545489, but rounding 0.5455 again
   to a tenth gives 54.6 — half a tenth above what those 1,268,209 v
   1,056,696 ballots say, and enough to make the flow-drift table's own row
   sum to 100.1 and disagree with the /preference-flows explainer, which
   quotes the count. Anything showing the election row to a reader uses
   these; anything computing with it uses FLOW. */
export const FLOW_PCT = Object.freeze({ grn: 88.2, onp: 25.5, oth: 54.5 });

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
    + FLOW.oth * (n0(p.ind) + n0(p.oth));
};

/* FLOW_ERAS – the pre-1987 counterpart of FLOW. F2F Morgan Gallup waves of
   the 1972–87 era (the aeforecasts mirror import) publish NO 2PP – Morgan
   did not publish a national two-party figure then – so the rows carry an
   IMPLIED 2PP (tppEra key → constants), derived by last-election flows the
   way Kevin Bonham's Wonk Central piece
   (kevinbonham.blogspot.com/2015/09/wonk-central-track-record-of-last.html)
   applies them to modern polls:

   1. Each era reads a poll's primaries through the flow constants measured
      at the election that OPENED the cycle (LEF: constants of election E
      serve the polls of the E→E+1 cycle, never E's own).
   2. The constants were calibrated per election against that election's
      OFFICIAL national 2PP (AEC/published: 1972 52.7, 1974 51.7, 1975 44.3,
      1977 45.4, 1980 49.6, 1983 53.23, 1984 51.77, 1987 50.83, ALP share)
      using national primaries from the pappubahry election-statistics
      dataset: f_oth pinned at 0.45 (the stable solved value for the
      genuine minor/independent remainder in the DLP-era fit), the era's
      headline minor party (DLP to 1975, Democrats from 1977) solved per
      election, DLP pinned at 0.27 in the Democrat era (its vote was ≤1.4%
      and collapsing – the pooled DLP-era estimate).
   3. The 1977 Democrat debut is a structural break (Bonham's "completely
      obvious at the time" case): no prior Democrat flow exists, so the
      1975 set carries dem=0.50 as an explicit debut assumption.

   Right-edge backtest (each set's constants applied to the CLOSING
   election's actual primaries vs its official 2PP): 1974 −0.04, 1975
   +0.20, 1977 −0.20, 1980 −0.35, 1983 −0.14, 1984 −0.24, 1987 −0.24.
   Every cycle lands inside Bonham's measured pre-1983 LEF error budget
   (±0.6) and the broader post-1983 one (±0.3–1.1); the piece's own
   normalised-error numbers are the figure the cyclePollBases notes quote.
   The implied figure is tagged per row with `tppEra` (the opening election
   year, i.e. the key below), and validate.mjs inverts era rows against
   THESE constants instead of the 2025 set. */
export const FLOW_ERAS = Object.freeze({
  1972: { dlp: 0.2765, oth: 0.45 },
  1974: { dlp: 0.3032, oth: 0.45 },
  1975: { dlp: 0.1551, dem: 0.5, oth: 0.45 },
  1977: { dlp: 0.27, dem: 0.5033, oth: 0.45 },
  1980: { dlp: 0.27, dem: 0.5571, oth: 0.45 },
  1983: { dlp: 0.27, dem: 0.584, oth: 0.45 },
  1984: { dlp: 0.27, dem: 0.6287, oth: 0.45 },
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
