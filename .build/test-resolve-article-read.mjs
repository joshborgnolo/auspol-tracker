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

// leadership: Hanson's performance and likeability, which data.json lacks
import { dwTable, perfOf, likeTableOf, likeProseOf } from "./resolve-article-read.mjs";
eq("Oct 2026 Datawrapper EoG2C: performance by leader", perfOf(dwTable("\tAlbanese\tTaylor\tHanson\nGood\t36%\t41%\t45%\nUndecided\t9%\t25%\t14%\nPoor\t54%\t34%\t41%")),
  { alb: { app: 36, dis: 54 }, opp: { app: 41, dis: 34 }, han: { app: 45, dis: 41 } });
const like = dwTable("NET LIKEABILITY (POS. – NEG.)\tFeb-26\tMar-26\tApr-26\nAnthony Albanese\t-12\t-12\t-12\nMatt Canavan\t\t\t8\nAngus Taylor\t3\t13\t16\nPauline Hanson\t7\t10\t6");
eq("Apr 2026 Datawrapper URiXo: this wave's column", likeTableOf(like, "2026-04-18"), { alb: -12, opp: 16, han: 6 });
eq("a likeability table whose last column is another month files nothing", likeTableOf(like, "2026-05-16"), {});
const octLike = "Similarly, Hanson’s net likeability rating fell from 7 points to zero, while Taylor’s rating fell 2 points to 8 per cent and Albanese’s improved by 1 point to minus 15 per cent. Larissa Waters’ net likeability score was plus 5 percentage points, well ahead of Shoebridge on minus 3 points.";
eq("Oct 2026 prose: three clauses, each reconciled", likeProseOf(octLike, { alb: -16, opp: 10, han: 7 }).ok, { han: 0, opp: 8, alb: -15 });
eq("Oct 2026 prose: a change that doesn't reach last month is refused", Object.keys(likeProseOf(octLike, { alb: -16, opp: 9, han: 7 }).ok), ["han", "alb"]);
eq("Aug 2026 prose: 'on minus 14 per cent, a 1 point improvement'", likeProseOf("On the likeability ratings, Albanese’s remains solidly in negative territory – where it has been since January 2026 – on minus 14 per cent, a 1 point improvement on last month.", { alb: -15 }).ok, { alb: -14 });
eq("Feb 2026 prose: two leaders in one clause files nothing for them", likeProseOf("Taylor secured a plus 3 percentage point likeability rating, reflecting his status as a new leader, compared with a net likeability rating for Albanese of minus 12 percentage points and minus 11 percentage points for Ley.").ok, {});
eq("performance prose is not likeability", likeProseOf("Hanson outscored Albanese and Taylor on the leaders’ performance ratings, with 45 per cent rating her performance as good.").ok, {});

console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
