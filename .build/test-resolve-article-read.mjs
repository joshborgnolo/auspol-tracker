#!/usr/bin/env node
// Offline checks for resolve-article-read.mjs: the fieldwork and sample
// phrasings of the Aug–Oct 2026 SMH/Age Resolve stories (quoted verbatim),
// and the phrasings that must not file.
import { windowOf, sampleOf, publishedOf, storiesOf } from "./resolve-article-read.mjs";

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};
const win = (t, d) => { const w = windowOf(t, d); return w && [w.dateStart, w.date]; };

const oct = "though a majority of the 2250 voters Resolve Political Monitor surveyed from Tuesday to Saturday of last week were not even aware";
eq("Oct 2026: weekday window before the Sunday story", win(oct, "2026-10-11"), ["2026-10-06", "2026-10-10"]);
eq("Oct 2026: sample before 'surveyed'", sampleOf(oct), 2250);
const sep = "The Resolve Political Monitor was conducted for this masthead from September 6 to 12 and surveyed 2250 voters, with a margin of error of plus or minus 2";
eq("Sep 2026: month window", win(sep, "2026-09-13"), ["2026-09-06", "2026-09-12"]);
eq("Sep 2026: 'surveyed 2250 voters'", sampleOf(sep), 2250);
const aug = "The findings are contained in the Resolve Political Monitor conducted for this masthead from August 9 to 15. More than 2200 voters were surveyed, with a margin of error of plus or minus 2";
eq("Aug 2026: month window", win(aug, "2026-08-16"), ["2026-08-09", "2026-08-15"]);
eq("Aug 2026: 'More than 2200' is not a sample", sampleOf(aug), null);
eq("window across a month end", win("conducted from September 30 to October 4", "2026-10-05"), ["2026-09-30", "2026-10-04"]);
eq("day-first window", win("surveyed between 4 and 10 October", "2026-10-11"), ["2026-10-04", "2026-10-10"]);
eq("window across a year end", win("conducted from December 28 to January 3", "2027-01-04"), ["2026-12-28", "2027-01-03"]);
eq("weekdays outside survey talk don't file", win("Parliament sits from Tuesday to Thursday", "2026-10-11"), null);
eq("no window stated", win("Albanese’s approval slid to 36 per cent", "2026-10-11"), null);

eq("article stamp is the first datePublished", publishedOf('{"datePublished":"2026-10-11T07:00:00Z"} {"datePublished":"2026-09-30T06:08:39Z"}'), "2026-10-11T07:00:00Z");
eq("topic page: federal stories, deduped, slug day", storiesOf(
  '<a href="/politics/federal/voters-cool-20261011-p614hp.html"></a><a href="/politics/federal/voters-cool-20261011-p614hp.html"></a><a href="/politics/victoria/state-poll-20261011-p614aa.html"></a>'),
  [{ url: "https://www.smh.com.au/politics/federal/voters-cool-20261011-p614hp.html", day: "2026-10-11" }]);

console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
