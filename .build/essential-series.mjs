/* Flourish charts can change without the WordPress page's modified stamp
   moving. These running vote-series pages are never stale by that stamp. */
export const LIVE_SERIES_URLS = new Set([
  "https://essentialreport.com.au/reports/federal-political-insights",
]);

export function shouldCrawlReport(report, pagesBefore, recent) {
  return LIVE_SERIES_URLS.has(report.link) || pagesBefore[`r${report.id}`] !== report.modified || recent(report);
}
