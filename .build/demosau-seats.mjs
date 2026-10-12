// DemosAU MRP seat projections from the report PDF's text (pdftotext
// -layout), for extract-demosau.mjs: the central projection per party,
// its change on the 2025 result, and the range from the seat
// classifications. Its own module so test-demosau-seats.mjs can read the
// layouts offline (the extractor runs its pipeline on import).

// "Other" is the site's others bucket, `oth` (the key the views list and
// the May–Jul 2026 row carries); the rows filed before then used `ind`
export const SEAT_LABEL = { labor: "alp", "one nation": "onp", coalition: "lnp", green: "grn", greens: "grn", other: "oth", others: "oth" };

// Two report layouts: "Projection: Seats Won" (MRP Estimate / 2025 Seats /
// Change; Oct–Nov 2025, Feb–Mar 2026) and, from May–Jul 2026, "Central Seat
// Projection" (Projection / Seat Change). Either way the change is on the
// 2025 result; the ranges come from "Seat Classifications".
export function parseSeats(text) {
  const p = {};
  let projIdx = text.search(/Projection:\s*Seats Won/i);
  if (projIdx === -1) projIdx = text.search(/Central\s+Seat\s+Projection/i);
  if (projIdx === -1) return { error: "no 'Projection: Seats Won' or 'Central Seat Projection' table" };
  const proj = text.slice(projIdx, projIdx + 1500);
  const projRe = /^\s*(Labor|One Nation|Coalition|Greens?|Others?)\s+(\d+)\s+(?:(\d+)\s+)?([+-]?\d+)\s*$/gim;
  let m;
  while ((m = projRe.exec(proj))) {
    const k = SEAT_LABEL[m[1].toLowerCase()];
    if (k && !p[k]) p[k] = { est: +m[2], chg: +m[4] };
  }
  if (Object.keys(p).length < 4) return { error: `seat projection parsed ${Object.keys(p).length}/5 parties` };

  const clsIdx = text.search(/Seat\s*Clas+s?ifications/i);
  if (clsIdx !== -1) {
    const cls = text.slice(clsIdx, clsIdx + 1800);
    const rngRe = new RegExp(`^\\s*(${Object.keys(SEAT_LABEL).map((s) => s[0].toUpperCase() + s.slice(1)).join("|")})\\s+\\d+\\s+\\d+\\s+\\d+\\s+\\d+\\s+(\\d+)\\s*-\\s*(\\d+)\\s*$`, "gim");
    while ((m = rngRe.exec(cls))) {
      const k = SEAT_LABEL[m[1].toLowerCase()];
      if (k && p[k]) { p[k].lo = +m[2]; p[k].hi = +m[3]; }
    }
  }
  return { seats: { total: 150, basis: "2025 election", p } };
}
