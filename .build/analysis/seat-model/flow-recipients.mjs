#!/usr/bin/env node
/* flow-recipients.mjs — W5.1: the seat sim's national flow fallback, DERIVED
   from the site's canonical 2PP flow constants (.build/newtracker/flows.mjs)
   instead of the W2 aggregate of 2025 count rows.

   Why: the old fallback summed every seat's certified group→group flow rows.
   A 2025 Coalition-exclusion row exists in only 25 of 150 seats — all
   teal-type contests where One Nation was already out — so the aggregated
   lp/lnp row sent ~half of an excluded Coalition pile to ALP and ~0% to ON,
   manufacturing ALP wins in every simulated ALP v ON final (58.5 expected
   such finals vs a certified count of zero in 2025). The national fallback
   now reads the same constants that price the site's implied 2PP, so a
   constants refresh flows through automatically:

     grn excluded → ALP at FLOW.grn (0.8819), rest to the Coalition
     onp excluded → ALP at FLOW.onp (0.2550), rest to the Coalition
     oth excluded → ALP at FLOW.oth (0.5455), rest to the Coalition

   Rows the TPP constants cannot price:

   - COALITION excluded (lp/np/lnp/clp). No certified 2025 Coalition→ON row
     exists anywhere (zero seats produced that count), and the TPP table has
     no use for one, so:
       · ALP share = COAL_LEAK_ALP ≈ 0.178 — the measured per-ballot
         three-cornered leak behind FLOW_3CNR (Liberal 12.47% of 11,176;
         Nationals 18.97% of 51,243 — counts in flows.mjs), blended
         11,117/62,419.
       · ON share = COAL_TO_ON = 0.65 — a STATED MODELLING CONSTANT, chosen
         reciprocal-consistent with the certified on→Coalition 61.5% row. It
         only binds in draws where ON is still standing; sensitivity belongs
         to the holdout gate, not this file.
       · the remainder splits oth (0.10) over sibling-Coalition keys — in a
         real 3-corner count a collapsed partner's pile mostly stays inside
         the Coalition.
   - ALP excluded. Rare final shapes (GRN/ON/IND v Coalition). No national
     measurement; stated constants mirroring the certified minor-party
     posture — left-leaning receivers first.
   - member / ind-declared (teal-profile independents). Held members keep
     their certified per-seat rows; these rows fire only for a synthetic or
     cross-seat case.

   Contract with swing-simulate.mjs: NATIONAL_FLOWS[g] is a {destGroup:
   share} row in the sim's RAW group vocabulary (lp/np/lnp/clp, member for
   member:*); the sim renormalises each row onto the candidates actually
   standing, so extra destinations (a Coalition partner not running, ON not
   contesting) drop out at use time. Coalition-destination shares are spread
   across lp/np/lnp/clp by 2025 candidacy counts (106/19/30/2) so each row
   sums to 1. Every row sums to 1 — pinned by test-swing-simulate.mjs. */

import { FLOW } from "../../newtracker/flows.mjs";

/* Coalition candidacy spread 2025 (counted from data/aec-2025-seat-flows.json):
   lp 106 · np 19 · lnp 30 · clp 2 — gives each national row a canonical
   sum-1 shape over whichever Coalition variant a seat actually runs. */
const COAL_N = { lp: 106, np: 19, lnp: 30, clp: 2 };
const COAL_TOT = Object.values(COAL_N).reduce((a, b) => a + b, 0);
const coalSpread = (share, exclude) => {
  const over = COAL_TOT - (exclude ? COAL_N[exclude] : 0);
  return Object.fromEntries(Object.entries(COAL_N)
    .filter(([g]) => g !== exclude)
    .map(([g, n]) => [g, share * n / over]));
};

export const COAL_LEAK_ALP = 11117 / 62419;   // ≈ 0.178 — see header
export const COAL_TO_ON = 0.65;               // stated constant — see header

const COAL_ROW = (self) => ({
  alp: COAL_LEAK_ALP,
  on: COAL_TO_ON,
  oth: 0.10,
  ...coalSpread(1 - COAL_LEAK_ALP - COAL_TO_ON - 0.10, self),
});

export const NATIONAL_FLOWS = {
  alp: { grn: 0.45, oth: 0.25, on: 0.10, member: 0.05, ...coalSpread(0.15) },
  grn: { alp: FLOW.grn, ...coalSpread(1 - FLOW.grn) },
  on: { alp: FLOW.onp, ...coalSpread(1 - FLOW.onp) },
  oth: { alp: FLOW.oth, ...coalSpread(1 - FLOW.oth) },
  member: { alp: 0.40, oth: 0.20, grn: 0.20, on: 0.05, ...coalSpread(0.15) },
  "ind-declared": { alp: 0.35, oth: 0.20, grn: 0.15, on: 0.05, ...coalSpread(0.25) },
  lp: COAL_ROW("lp"),
  np: COAL_ROW("np"),
  lnp: COAL_ROW("lnp"),
  clp: COAL_ROW("clp"),
};

/* map the sim's group vocabulary (member:<name>) onto a row */
export const nationalFlowRow = (group) =>
  NATIONAL_FLOWS[group] || NATIONAL_FLOWS[group.split(":")[0]] || null;

if (process.argv[1] && process.argv[1].endsWith("flow-recipients.mjs")) {
  for (const [g, row] of Object.entries(NATIONAL_FLOWS)) {
    const t = Object.values(row).reduce((a, b) => a + b, 0);
    console.log(g.padEnd(13), `sum ${t.toFixed(4)}`,
      JSON.stringify(Object.fromEntries(Object.entries(row).map(([k, v]) => [k, +v.toFixed(4)]))));
  }
}
