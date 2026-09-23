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

/* FLOW_LEF – one flow table per election from 1987 to 2022, so every past
   term's two-party line on Past cycles is read the way the current term's
   implied 2PP is: each poll's primaries through the flows counted at the
   election that OPENED the term (last-election flows – the only table an
   observer inside the term could have used, and the method Kevin Bonham's
   Wonk Central track record audits). The 2025 table is FLOW above; the
   1972–84 terms keep FLOW_ERAS. Derived by .build/aec-flow-history.py from
   the AEC's own counts, cached in .build/aec-flow-src/:
     2004–2022  AEC two-party-preferred flow by state by party – every formal
                ballot in every seat redistributed ALP v Coalition (the TPP
                cut FLOW ships for 2025).
     1996–2001  AEC official election statistics, "Two Candidate Preferred
                Preference Flow Result", classic seats only (final two ALP v
                a Coalition party: 142, 144 and 136 seats) – counted flows
                over nine seats in ten, since no all-seat TPP cut exists.
     1987–1993  no flow by party was published before 1996, so the table is
                the single lumped minor-party flow the official result
                implies: (ALP 2PP − ALP primary) ÷ (100 − ALP − Coalition).
   Buckets are the poll columns they are applied to: grn every Greens party,
   onp One Nation, oth every other non-major ballot (independents in). share
   is the election's own national primary for each bucket – the weights for
   a poll that folds a bucket into its oth column. anchor is what the table
   leaves between the election's own primaries and its official 2PP (the
   three-cornered leak in the TPP cut, like FLOW_3CNR; non-classic seats in
   the classic cut); added back so month 0 of every term is the count.
   Right-edge backtest – each table on the NEXT election's primaries against
   its official 2PP, ALP points (the LEF error Bonham tabulates): 1990 −0.44,
   1993 +0.13, 1996 +0.81, 1998 +0.06, 2001 −0.14, 2004 +0.38, 2007 +0.02,
   2010 +0.31, 2013 −1.04, 2016 −0.23, 2019 +0.83, 2022 −0.97, 2025 −0.38;
   mean |error| 0.44. The signs and sizes of the big misses – Labor beating
   the projection in 1990, 2013 and 2022, the 0.8 shift to the Coalition in
   2019 – are the ones Bonham documents. */
export const FLOW_LEF = Object.freeze({
  1987: { minor: 0.5882, anchor: 0, bt: -0.44 },
  1990: { minor: 0.6140, anchor: 0, bt: 0.13 },
  1993: { minor: 0.6019, anchor: 0, bt: 0.81 },
  1996: { grn: 0.6710, oth: 0.5092, anchor: 0.209, bt: 0.06, share: { grn: 1.74, onp: 0, oth: 12.27 } },
  1998: { grn: 0.7328, onp: 0.4634, oth: 0.5534, anchor: -0.027, bt: -0.14, share: { grn: 2.14, onp: 8.43, oth: 9.82 } },
  2001: { grn: 0.7463, onp: 0.4415, oth: 0.5761, anchor: -0.083, bt: 0.38, share: { grn: 4.96, onp: 4.34, oth: 9.85 } },
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
