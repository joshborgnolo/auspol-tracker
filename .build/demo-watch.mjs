/* The reminders watch for the HAND-ENTERED houses behind
   data/demographics.json – pure functions imported by demographics.mjs and
   pinned by test-demo-watch.mjs; no fs, no network.

   Roy Morgan, Newspoll, Fox & Hedgehog and Freshwater breakdowns are
   hand-entered blocks in demographics.mjs, so a missed arrival can never
   trip the stale/dropped alarms: this watch notices the release shapes a
   hand-entry wave takes and lists them as `reminders`. A reminder fails
   the weekly crosstabs run until the wave is entered, or KNOWN_SKIP (in
   demographics.mjs) records it as checked by hand. Three shapes:

   (a) a Newspoll (pooled) / Roy Morgan (pooled) aggregate row exists in
       polls.json but its printed breakdowns were never entered – pure
       bookkeeping lag (the Apr–Jun 2026 Newspoll quarterly sat three
       months: published 3 Jul, entered in October);
   (b) a Newspoll quarter gone quiet means a quarterly was missed
       entirely;
   (c) a fresh Roy Morgan wave whose findings-cache JSON prints the forms
       of a demographic release – per-state subsamples (finding 10363's
       state tables) or a special title (finding 10341's Country of
       Birth). The signatures are precision-only: a wave we say nothing
       about is a wave we did not catch, never a wave checked. */
export const NP_POOLED_LAG_DAYS = 10;         // a pooled aggregate's breakdowns are hand-entry work once this old
export const NP_POOLED_CADENCE_DAYS = 110;    // Newspoll's quarterly-aggregate habit – this quiet means a release was missed
export const RM_WATCH_DAYS = 45;              // the findings-cache probe reaches this far back for Roy Morgan waves

export const RM_WATCH_SIGNS = [
  [/\bNSW\s*\(n\s*=\s*[\d,]+\)[^<>]{0,80}\bVic\s*\(n\s*=\s*[\d,]+\)/, "per-state subsamples (10363's state tables – enter under ROYMORGAN_DEMO/ROYMORGAN_STATE)"],
  [/(?:voting intentions?|primary vote)[^<>]{0,60}\bby (state|country of birth)\b/i, "a special demographic title (10341's Country of Birth – enter under ROYMORGAN_COUNTRY)"],
];

export const rmFindingId = (url) => /\/findings\/(\d+)/.exec(url || "")?.[1] || null;

/* The first signature the cached release JSON trips, or null. The cache
   content is HTML (<strong>NSW </strong>(n=765)); tags reduce to spaces
   before the plain-phrase signatures run. */
export function rmSignsWhy(rel) {
  const hay = [rel?.archiveName, rel?.archiveUri, rel?.content].filter(Boolean).join("\n").replace(/<[^>]+>/g, " ");
  for (const [re, why] of RM_WATCH_SIGNS) if (re.test(hay)) return why;
  return null;
}

/* reminders({polls, waves, knownSkip, rmReleaseFor, now}) -> [string]
   polls         rows of data/polls.json's `polls` array
   waves         the wave objects this run assembled (committed + new)
   knownSkip     demographics.mjs's KNOWN_SKIP object
   rmReleaseFor  (finding id) -> parsed release-*.json cache, or null
   now           a Date, injected so the pins are clock-free */
export function watchReminders({ polls, waves, knownSkip, rmReleaseFor, now }) {
  const key = (w) => w.pollster + "|" + w.date;
  const onFile = new Set(waves.map(key));
  const checkedSkip = new Set(Object.keys(knownSkip));
  const daysAgo = (d) => (now.getTime() - Date.parse(d + "T00:00:00Z")) / 864e5;
  const reminders = [];
  // (a) a Newspoll/Roy Morgan (pooled) aggregate row exists but its printed
  // breakdowns were never entered – pure bookkeeping lag (the Apr–Jun 2026
  // quarterly sat three months: published 3 Jul, entered in October)
  for (const p of polls) {
    if (p.pollster !== "Newspoll (pooled)" && p.pollster !== "Roy Morgan (pooled)") continue;
    const k = key(p);
    if (onFile.has(k) || checkedSkip.has(k) || daysAgo(p.date) <= NP_POOLED_LAG_DAYS) continue;
    reminders.push(`${k}: the aggregate row's printed breakdowns are unentered – hand-enter (NEWSPOLL_DEMO / ROYMORGAN_COUNTRY), or KNOWN_SKIP it as checked`);
  }
  // (b) …and a Newspoll quarter gone quiet means a quarterly was missed entirely
  const npNewest = polls.filter((p) => p.pollster === "Newspoll (pooled)").reduce((a, p) => (p.date > a ? p.date : a), "");
  if (npNewest && daysAgo(npNewest) > NP_POOLED_CADENCE_DAYS)
    reminders.push(`Newspoll (pooled): no quarterly aggregate in ${Math.floor(daysAgo(npNewest))} days (newest ${npNewest}) – check The Australian for a new quarterly`);
  // (c) a fresh Roy Morgan wave whose findings-cache JSON prints the shapes a
  // demographic release has taken. A wave whose cache file is gone stays
  // silent – this watches recent arrivals.
  for (const p of polls) {
    if (p.pollster !== "Roy Morgan" || daysAgo(p.date) < 0 || daysAgo(p.date) > RM_WATCH_DAYS) continue;
    const k = key(p);
    if (onFile.has(k) || checkedSkip.has(k)) continue;
    const id = rmFindingId(p.url);
    const rel = id ? rmReleaseFor(id) : null;
    if (!rel) continue;                       // no cache to probe: silent
    const why = rmSignsWhy(rel);
    if (why) reminders.push(`${k}: the findings cache carries ${why} – check the release for printed breakdowns, then hand-enter or KNOWN_SKIP it`);
  }
  return reminders;
}
