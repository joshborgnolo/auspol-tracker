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
