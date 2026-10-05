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
   context of the page it was read on. The ONLY legitimate previous-year
   case is a December stamp read on a January page (the December tail);
   any other stamp month ahead of the page month means the capture itself
   is mislabeled (Wayback holds front-page captures keyed 2025-09-26 whose
   bytes carry a 5-Oct widget), and the caller's date<=pageDate guard
   then skips it */
export function stampDate(stamp, pageYear, pageMonth) {
  if (!stamp || !stamp.mon) return null;
  let y = pageYear;
  if (stamp.mon === 12 && pageMonth === 1) y -= 1;
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

/* His stamps are Hobart dates, so "is this stamp in the future?" and "which
   year is it?" must be asked on Hobart's calendar. From 13:00 or 14:00 UTC
   Hobart is already on the next day: a UTC comparison rejected his fresh
   morning updates as future-dated (ten valid Wayback captures in the
   2026-10-05 sweep). */
const HOBART_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Hobart", year: "numeric", month: "2-digit", day: "2-digit" });
export const hobartIso = (date) => HOBART_DAY.format(date);
/* a Wayback timestamp (YYYYMMDDhhmmss, UTC) as the Hobart date it was taken on */
export const waybackHobartIso = (ts) => hobartIso(new Date(Date.UTC(
  +ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8), +ts.slice(8, 10) || 0, +ts.slice(10, 12) || 0, +ts.slice(12, 14) || 0)));

/* The One Nation shadow-2PP rows are change points: [date, alpShare] is
   added only when his figure differs from the last row, so the series
   holds what he published and when, and a reading of an unchanged figure
   writes nothing (keying rows by fetch day added a duplicate every day and
   sent the poll agent through a full build and push for it). The widget
   has no stamp of its own. It moves when he adds a poll, which is when the
   classic stamp moves too, so a change is dated at that stamp when the
   stamp is newer than the last row; otherwise at the reading's own Hobart
   date. Two changes on one date keep the later. Mutates rows; returns
   whether anything changed. */
export function shadowChange(rows, value, stampIso, seenIso) {
  const last = rows.length ? rows[rows.length - 1] : null;
  if (last && last[1] === value) return false;
  const date = stampIso && stampIso <= seenIso && (!last || stampIso > last[0]) ? stampIso : seenIso;
  if (last && date <= last[0]) { last[1] = value; return true; }
  rows.push([date, value]);
  return true;
}

/* collapse runs of an unchanged figure to their first date, the change-point
   form shadowChange keeps */
export const changePoints = (rows) => rows.filter((r, i) => i === 0 || r[1] !== rows[i - 1][1]);
