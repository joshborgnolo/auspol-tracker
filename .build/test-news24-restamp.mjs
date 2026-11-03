/* Test for extract-news24.mjs's restamp leg — replacing the provisional
   evening publication stamp (News24 shows ~9pm on drop night) with the
   FINAL display byline its CMS writes overnight ("November 4, 2026 -
   5:00AM"). Canon published is the final byline (the T05:00 series); the
   provisional form became fileable once the evening comb existed, and this
   is the leg that keeps it canonical. Run: node .build/test-news24-restamp.mjs */
import assert from "node:assert/strict";

process.env.N24_LIB = "1";
const { needsRestamp, restampProvisional } = await import("./extract-news24.mjs");

const byline = (s) => `<html><body><div id="publish-date">${s}</div></body></html>`;
const JSONLD = (s) => `<html><head><script type="application/ld+json">{"datePublished": "${s}"}</script></head></html>`;
const row = (over) => ({
  date: "2026-11-03", pollster: "YouGov", client: "News24", published: "2026-11-03T21:00",
  url: "https://www.news24.com.au/politics/x/news-story/" + "a".repeat(32), ...over,
});
const run = (rows, html, todayIso = "2026-11-04") => {
  let fetches = 0;
  const fetchArticle = async () => { fetches++; return typeof html === "function" ? html() : html; };
  return restampProvisional(rows, { fetchArticle, todayIso }).then((dates) => ({ dates, fetches }));
};

// candidate gate: only a fresh evening-stamped YouGov row is a candidate
assert.equal(needsRestamp("2026-11-03", "2026-11-03T21:00", "2026-11-04"), true, "evening stamp is provisional");
assert.equal(needsRestamp("2026-11-03", "2026-11-04T05:00", "2026-11-04"), false, "morning stamp is final");
assert.equal(needsRestamp("2026-11-03", "2026-11-03T16:30", "2026-11-04"), false, "daytime stamp is not evening");
assert.equal(needsRestamp("2026-11-03", null, "2026-11-04"), false, "no stamp, no restamp");
assert.equal(needsRestamp("2026-10-10", "2026-10-10T21:00", "2026-11-04"), false, "rewrite window has closed");
assert.equal(needsRestamp("2026-11-05", "2026-11-05T21:00", "2026-11-04"), false, "future wave is not a candidate");

// the final byline lands: the provisional stamp is replaced
{
  const r = row();
  const { dates, fetches } = await run([r], byline("November 4, 2026 - 5:00AM"));
  assert.deepEqual(dates, ["2026-11-03"], "restamped date is reported");
  assert.equal(r.published, "2026-11-04T05:00", "final byline replaces the provisional stamp");
  assert.equal(fetches, 1, "one fetch");
}

// byline still provisional → nothing changes
{
  const r = row();
  const { dates } = await run([r], byline("November 3, 2026 - 9:00PM"));
  assert.deepEqual(dates, [], "provisional byline leaves the stamp");
  assert.equal(r.published, "2026-11-03T21:00");
}

// a final-form byline in a different form (JSON-LD fallback path):
// 2026-11-03T18:00:00Z + Melbourne DST (UTC+11) = 2026-11-04T05:00 local
{
  const r = row();
  const { dates } = await run([r], JSONLD("2026-11-03T18:00:00.000Z"), "2026-11-04");
  assert.deepEqual(dates, ["2026-11-03"], "JSON-LD byline restamps when final");
  assert.equal(r.published, "2026-11-04T05:00");
}

// a canon-stamped row is never even fetched
{
  const r = row({ published: "2026-11-04T05:00" });
  const { dates, fetches } = await run([r], byline("November 4, 2026 - 5:00AM"));
  assert.deepEqual(dates, []); assert.equal(fetches, 0, "final stamp is not re-read");
}

// fetch failure / no byline → unchanged, no throw
{
  const r = row();
  const { dates } = await run([r], null);
  assert.deepEqual(dates, []); assert.equal(r.published, "2026-11-03T21:00");
}

// a byline outside the wave window is a parse fault, not a rewrite
{
  const r = row();
  const { dates } = await run([r], byline("November 10, 2026 - 5:00AM"));
  assert.deepEqual(dates, [], "out-of-window byline rejected");
  assert.equal(r.published, "2026-11-03T21:00");
}

// an old provisional row is left alone (and never fetched)
{
  const r = row({ date: "2026-10-10", published: "2026-10-10T21:00" });
  const { dates, fetches } = await run([r], byline("October 11, 2026 - 5:00AM"));
  assert.deepEqual(dates, []); assert.equal(fetches, 0, "rewrite window closed");
}

// a row with no stamp at all is left to the upgrade leg
{
  const r = row({ published: undefined });
  delete r.published;
  const { dates, fetches } = await run([r], byline("November 4, 2026 - 5:00AM"));
  assert.deepEqual(dates, []); assert.equal(fetches, 0, "stampless rows not restamped");
}

console.log("test-news24-restamp: all pass");
