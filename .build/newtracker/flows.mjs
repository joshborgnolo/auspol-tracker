/* flows.mjs – the ONE definition of the preference-flow constants, imported
   by validate.mjs (2PP inversion check) and gen-data.mjs (synthetic-2PP
   diagnostic), so the gate and the diagnostic can never drift apart.

   Measured from the AEC 2025 TCP flow-by-party download (Event 31496,
   HouseTcpFlowByPartyDownload-31496.txt) by .build/aec-flows.py; the full
   provenance table, the 2022-vs-2025 comparison and the evidence for keeping
   these coarse live in validate.mjs's check-7 comment. Re-derive after each
   federal election. */
export const FLOW = Object.freeze({ grn: 0.8683, onp: 0.2710, oth: 0.4849 });

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
