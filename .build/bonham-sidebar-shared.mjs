/* bonham-sidebar-shared.mjs – the sidebar parse shared by the live scraper
   (.build/extract-bonham-sidebar.mjs) and the one-off Wayback backfill
   (.build/bonham-wayback-backfill.mjs), so the two readers of Kevin
   Bonham's sidebar can never drift on what the widget looks like.
   Pure functions only: no fetch, no fs, no clock. */

export const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export const ALP_RANGE = [40, 70];  // his aggregate ALP share this term
export const SUM_TOL = 0.15;        // X + Y must be 100

export const stripTags = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ");

/* Scan stripped page text for the classic-2PP widget. Returns
   { alp, lnp, stamp: {day, mon, house}, shadow } or null when the widget
   isn't there — the previous-term "Federal 2PP Aggregated Polling
   Estimate (By 2022 Election Preferences) … to ALP" widget deliberately
   misses the exact-case current title, and the months the site carried no
   aggregate widget at all (mid-2025) simply parse to null. */
export function parseSidebar(text) {
  const m = /Federal 2PP Polling Aggregate\s+(\d{2}(?:\.\d)?)-(\d{2}(?:\.\d)?)\s+TO ALP/.exec(text);
  if (!m) return null;
  const alp = Number(m[1]), lnp = Number(m[2]);
  const stamp = /Last update\s+(\d{1,2})\s+([A-Za-z]+)\s*\(([^)]+)\)/.exec(text.slice(m.index));
  const shadow = /One Nation Shadow-2PP Estimate\s+(\d{2}(?:\.\d)?)-(\d{2}(?:\.\d)?)\s+TO ALP vs ON/.exec(text);
  return {
    alp, lnp,
    stamp: stamp ? { day: +stamp[1], mon: MONTHS[stamp[2].slice(0, 3).toLowerCase()] || null, house: stamp[3].trim() } : null,
    shadow: shadow ? Number(shadow[1]) : null,
  };
}

/* resolve his year-less "Last update D Mon" stamp against the calendar
   context of the page it was read on (a stamp month ahead of the page
   month is last year's December tail) */
export function stampDate(stamp, pageYear, pageMonth) {
  if (!stamp || !stamp.mon) return null;
  let y = pageYear;
  if (stamp.mon > pageMonth) y -= 1;
  const iso = `${y}-${String(stamp.mon).padStart(2, "0")}-${String(stamp.day).padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/* the figure's internal sanity — every caller guards on the same rules */
export function figureOk(parsed) {
  return parsed
    && Math.abs(parsed.alp + parsed.lnp - 100) <= SUM_TOL
    && parsed.alp >= ALP_RANGE[0] && parsed.alp <= ALP_RANGE[1]
    && parsed.stamp && parsed.stamp.mon;
}
