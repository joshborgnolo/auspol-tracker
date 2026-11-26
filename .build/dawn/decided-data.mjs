/* The decidedness page's figures (/dawn/decidedness/), the main site's Decidedness section
   (rd-panels RdUndecided) read from its data asset: the five modelled lines (gen-data §5c), their
   history, RedBridge's firmness by party and Resolve's softness by age. The opening bar, the heads
   and the group verdicts follow that section's rules:
   - of every 100 voters: undecided = the asked-once share; soft = Resolve's soft share of those who
     named a party, put on all voters; firm = the rest;
   - "one in …" is the nearest of a few round fractions (rdOneIn, rdOneInShare);
   - one party's vote is called firmest only while its solid share is apart from the runner-up's (the
     two margins combined);
   - a line moved only when the 95% interval of its change since the term's first month excludes zero;
   - a party or age group changed only when its two readings are apart. */
import { engine } from "./disagree-data.mjs";

const NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const ONE_IN = [3, 4, 5, 10, 20, 50, 100], BIG = { 50: "fifty", 100: "a hundred" };
const nearest = (v) => ONE_IN.reduce((b, k) => (Math.abs(Math.log(100 / k / v)) < Math.abs(Math.log(100 / b / v)) ? k : b), ONE_IN[0]);
export const oneIn = (v) => { const n = nearest(v); return (Math.abs(100 / n - v) < 0.3 ? "one voter in " : "about one voter in ") + (BIG[n] || NUM[n]); };
export const oneInShare = (v) => { const n = nearest(v); return (Math.abs(100 / n - v) < 1.2 ? "" : "about ") + "one in " + (BIG[n] || NUM[n]); };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const list = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
const apart = (a, b) => Math.abs(a.v - b.v) > Math.hypot(a.ci95, b.ci95);
const PARTY = { alp: "Labor", lnp: "Coalition", onp: "One Nation", grn: "Greens", oth: "Others" };

/* of every 100 voters, from the two shares */
export function ofHundred(und, soft) {
  const u = Math.round(und), s = Math.round((soft * (100 - und)) / 100);
  return { firm: 100 - u - s, soft: s, und: u };
}

export function decidedStory(U, F) {
  const by = Object.fromEntries(U.series.map((s) => [s.id, s]));
  const nowOf = (s) => (s ? (s.now ? s.now.v : s.latest.v) : null);
  const u = nowOf(by.first), sf = nowOf(by.soft);
  const firmest = (() => {
    if (!F || !F.now) return "";
    const ord = ["onp", "alp", "lnp", "grn", "oth"].filter((k) => F.now[k]).sort((a, b) => F.now[b].v - F.now[a].v);
    if (ord.length < 2 || !apart(F.now[ord[0]], F.now[ord[1]])) return "";
    return ", and " + (ord[0] === "oth" ? "the minor-party" : "the " + PARTY[ord[0]]) + " vote is firmest";
  })();
  const head = cap(oneIn(u)) + " is undecided" + (sf != null ? ", " + oneInShare(sf) + " might change their mind" : "") + firmest;
  const NAME = { first: "undecided share asked once", leaner: "undecided share after a follow-up", tpp: "undecided share after preferences", soft: "Resolve’s soft share", softRB: "RedBridge’s soft share" };
  const moves = ["first", "leaner", "tpp", "soft", "softRB"].map((k) => by[k]).filter((s) => s && s.now && s.now.since);
  const sig = moves.filter((s) => s.now.since.sig);
  const dek = !sig.length ? (moves.length > 2 ? "None of the " + NUM[moves.length] + " measures has" : moves.length === 2 ? "Neither measure has" : "The share has") + " moved significantly since the 2025 election."
    : sig.map((s) => cap(NAME[s.id]) + " has " + (s.now.since.chg > 0 ? "risen" : "fallen") + " significantly since the 2025 election.").join(" ");
  return { head, dek };
}

export function partyStory(F) {
  const ids = ["onp", "alp", "lnp", "grn", "oth"].filter((k) => F.now[k] && F.base[k]).sort((a, b) => F.now[b].v - F.now[a].v);
  const rows = ids.map((k) => ({ id: k, label: PARTY[k], now: F.now[k].v, base: F.base[k].v, ci: F.now[k].ci95, sig: apart(F.now[k], F.base[k]) }));
  const sigRows = rows.filter((r) => r.sig), allSig = apart(F.now.all, F.base.all);
  const biggest = sigRows.slice().sort((a, b) => Math.abs(b.now - b.base) - Math.abs(a.now - a.base))[0];
  const onp = rows.find((r) => r.id === "onp");
  const tail = onp && onp.sig && biggest && biggest.id !== "onp" ? ", while One Nation voters have " + (onp.now < onp.base ? "softened" : "hardened") : "";
  const head = biggest ? (biggest.id === "oth" ? "Minor-party voters" : biggest.label + " voters") + " " + (biggest.now < biggest.base ? "have softened" : "have firmed") + " since July 2025" + tail
    : "No party’s voters have softened significantly since July 2025";
  const dek = "The share calling their vote solid, in RedBridge’s polls, mid-2025 to now."
    + (allSig ? " Among all voters it has " + (F.now.all.v < F.base.all.v ? "fallen" : "risen") + " significantly, from " + F.base.all.v.toFixed(1) + "% to " + F.now.all.v.toFixed(1) + "%." : "");
  const note = "RedBridge asks voters how firm their choice is, a different question from Resolve’s in the opening bar, so the two don’t compare directly. "
    + (!sigRows.length ? "Among the parties, no change is significant." : sigRows.length === 1 ? "Among the parties, only the " + (sigRows[0].id === "lnp" ? "Coalition" : sigRows[0].label) + "’s " + (sigRows[0].now < sigRows[0].base ? "fall" : "rise") + " is significant."
      : "Among the parties, " + list(sigRows.map((r) => r.label)) + " have changed significantly.");
  return { head, dek, note, rows, all: F.now.all.v, from: F.base.from + " to " + F.base.to, to: F.now.from + " to " + F.now.to };
}

export function ageStory(A) {
  const B = [["18-34", "18–34"], ["35-54", "35–54"], ["55+", "55+"]];
  const rows = B.map(([id, label]) => ({ id, label, now: A.now[id].v, base: A.base[id].v, ci: A.now[id].ci95, sig: apart(A.now[id], A.base[id]) }));
  const WHO = { "18-34": "young voters", "35-54": "middle-aged voters", "55+": "older voters" };
  const loose = rows.slice().sort((a, b) => b.now - a.now), least = loose[0], firm = loose[loose.length - 1];
  const head = loose.slice(1).every((r) => apart(A.now[least.id], A.now[r.id])) ? cap(WHO[least.id]) + " are the least firm"
    : apart(A.now[least.id], A.now[firm.id]) ? cap(WHO[least.id]) + " are less firm than " + WHO[firm.id]
    : "No age group is clearly less firm than the others";
  const changed = rows.filter((r) => r.sig);
  const note = "Resolve doesn’t publish how many people it asked in each age group, so each group is weighted by its share of adults (2021 Census). "
    + (apart(A.now["18-34"], A.now["55+"]) ? "The gap between 18–34s and over-55s is significant; " : "The gap between 18–34s and over-55s is not significant; ")
    + (changed.length ? "the change among " + list(changed.map((r) => (r.id === "55+" ? "over-55s" : r.label + "s"))) + " is significant." : "no group’s change is.");
  return { head, dek: "The share of those who named a party calling their vote soft, in Resolve’s polls, mid-2025 to now.", note, rows };
}

const LINE = {
  first: ["Asked once", "var(--dec-once)"], leaner: ["After a follow-up", "var(--dec-leaner)"], tpp: ["After preferences", "var(--dec-pref)"],
  soft: ["Resolve: soft", "var(--dec-resolve)"], softRB: ["RedBridge: soft or very soft", "var(--dec-redbridge)"],
};
export function decidedData(assets, source, { keys = new Set(), key = () => "" } = {}) {
  const { D } = engine(assets, source), U = D.undecided, F = D.firmness, DH = D.decidednessHistory;
  const by = Object.fromEntries(U.series.map((s) => [s.id, s]));
  const poll = (q) => { const k = key(q.pollster, q.released); return [q.x, q.v, q.pollster, q.dateLabel, ...(keys.has(k) ? [k] : [])]; };
  const line = (id) => {
    const s = by[id];
    return { id, name: LINE[id][0], color: LINE[id][1], houses: s.houses, now: s.now.v, ci: s.now.ci95,
      m: s.monthly.map((q) => [q.x, q.v, q.lo, q.hi, q.ym]), polls: s.polls.map(poll), since: s.now.since };
  };
  const und = ["first", "leaner", "tpp"].filter((id) => by[id]).map(line), soft = ["soft", "softRB"].filter((id) => by[id]).map(line);
  /* past terms: the undecided lines by question, back to the 1940s; the soft ones by pollster */
  const H = U.history || { terms: [], polls: [] };
  const undPast = H.terms.flatMap((t) => ["first", "leaner"].filter((b) => t.series[b]).map((b) => ({ id: b, name: LINE[b][0], color: LINE[b][1], year: t.year,
    m: t.series[b].months.map((q) => { const [y, m] = q[0].split("-").map(Number); return [Math.round((y + (m - 0.5) / 12) * 1e4) / 1e4, q[1], q[2], q[3], q[0]]; }) })));
  const softTerms = DH ? DH.soft.terms : [];
  const softPast = softTerms.map((t) => ({ id: t.id, name: LINE[t.id][0], color: LINE[t.id][1], year: t.year, m: t.monthly.map((q) => [q.x, q.v, q.lo, q.hi, q.ym]) }));
  const pastPolls = (rows) => rows.map((q) => [q.x, q.v, q.pollster, q.dateLabel, q.basis]);
  /* the opening bar, month by month from the first month both its lines have polls behind them */
  const from = [by.first, by.soft].map((s) => (s.now.since && s.now.since.from) || s.monthly[0].ym).sort().pop();
  const softAt = Object.fromEntries(by.soft.monthly.map((q) => [q.ym, q.v]));
  const months = by.first.monthly.filter((q) => q.ym >= from && softAt[q.ym] != null).map((q) => ({ ym: q.ym, ...ofHundred(q.v, softAt[q.ym]) }));
  const now = { ym: months[months.length - 1].ym, ...ofHundred(by.first.now.v, by.soft.now.v) };
  months[months.length - 1] = now;
  const gaps = (U.gaps || []).filter((g) => by[g.a] && by[g.b]).map((g) => ({ ...g, an: LINE[g.a][0], bn: LINE[g.b][0] }));
  const newest = [...und, ...soft].flatMap((s) => by[s.id].polls).sort((a, b) => (a.released < b.released ? 1 : -1))[0];
  const election = (D.elections && D.elections.e2025 && D.elections.e2025.date) || "2025-05-03";
  return {
    v: 1, asOf: D.latest.updatedISO || newest.released, latestPoll: { h: newest.pollster }, election: { date: election },
    hero: { months, now, shares: { und: by.first.now.v, soft: by.soft.now.v, undHouses: by.first.houses, softHouses: by.soft.houses } },
    story: decidedStory(U, F), und, soft, undPast, softPast, undPastPolls: pastPolls(H.polls), softPastPolls: pastPolls(softTerms.flatMap((t) => t.polls)), gaps,
    party: F ? partyStory(F) : null, age: U.softAge ? ageStory(U.softAge) : null,
  };
}
