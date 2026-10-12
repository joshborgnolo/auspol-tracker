// Where each house publishes the fieldwork dates a `fieldworkPending` row is
// waiting for: every "TBC" the site shows in place of those dates links here
// (user call 2026-10-11, restated 2026-10-12 after the 12 Oct DemosAU MRP
// showed a bare TBC). Keyed by HOUSE, so a house's other series ("DemosAU
// (MRP)") inherit its page; validate.mjs fails a pending row whose house has
// no entry, so a new house can't ship an unlinked TBC.
export const FIELD_TBC_URL = {
  DemosAU: "https://demosau.com/methodology-statements/",
  // assimilated Resolve waves wait on the SMH article for their dates
  Resolve: "https://www.smh.com.au/topic/resolve-political-monitor-6fhy",
};
export const fieldTbcUrl = (pollster) => FIELD_TBC_URL[String(pollster || "").replace(/\s*\(.*\)\s*$/, "").trim()] ?? null;
