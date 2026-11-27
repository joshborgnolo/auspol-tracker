/* The /dawn/ trial design's words, written by rule from its data (gen-data
   §13, assets/dawn-data.json). Every claim of a move, a lead or an order
   clears its own margin first, as the site's heads do; anything that does
   not is said to be level or much the same. build.mjs (this folder) fills
   the template with these; test-dawn.mjs pins each branch on mutated data.

   The rules, in full:
   - The primary vote's head names the largest change since the election
     that clears the model's 95% interval (the count itself has none). A
     party whose interval's LOWER end is at least twice its count "has more
     than doubled" (three times: tripled; four: quadrupled; five or more:
     "grown more than fivefold"), the multiple read off that lower end, so
     the words never claim more than the interval allows. A fall is named as
     the share of the election vote lost when the interval's UPPER end has
     lost at least a fifth (a fifth, a quarter, a third, half), else in
     points. No change clears: "much where it was".
   - Its dek lists up to two further changes that clear, largest first, in
     points.
   - The two-party head is the site's own chart story (rd-hero.jsx story):
     which rival runs Labor closer, "as close" unless the gap between the
     two contests clears both their margins combined and is a point or more.
   - The leadership ratings' head names the largest change among today's
     leaders since each started the term whose 95% interval (from the
     model's own draws of that change) excludes zero: "since the election"
     for a line that starts there, "since taking the job" for a leader who
     took over this term, else since the month of the first rating. None
     clears: "much where they started".
     The favourability chart's head is the same rule on its own lines. The
     preferred-PM head says who leads each running pairing, or that the two
     are level (ppmHead).
   - The mood page's direction head says the larger side's share as the
     nearest plain fraction (the site's plainShare), "the most this term"
     only when no week of the term's line reads higher. Its trust head says
     the model's share in tenths (tenthShare), "the lowest since <month>" only when
     the model's own test says so (trust.now.low2020, as the site's head).
     The trust dek names a change on a year ago only when its 95% interval
     excludes zero.
   - The past cycles page ranks this term against every earlier one at the
     same month (cycleRank, below).
   - The flow diagram's head reads each contest's verdict today: Labor or
     its rival ahead when the lead is outside the margin (twice the 95%
     interval, on the lead's scale, the flows' doubt added in quadrature
     against One Nation), else level. */

export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const fdate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return d + " " + MON[m - 1] + " " + y; };
const monthYear = (ym) => { const [y, m] = ym.split("-").map(Number); return MONF[m - 1] + " " + y; };

/* how each party is named: at a sentence's start, inside it, its possessive,
   and whether it takes a plural verb */
export const NAMES = {
  alp: { start: "Labor", in: "Labor", poss: "Labor’s", pl: false },
  lnp: { start: "The Coalition", in: "the Coalition", poss: "the Coalition’s", pl: false },
  grn: { start: "The Greens", in: "the Greens", poss: "the Greens’", pl: true },
  onp: { start: "One Nation", in: "One Nation", poss: "One Nation’s", pl: false },
  oth: { start: "Minor parties and independents", in: "minor parties and independents", poss: "minor parties’ and independents’", pl: true },
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

/* today's primaries against the count: [{ k, E, v, lo, hi, chg, sig }] */
export function primaryMoves(D) {
  const L = D.weeks.length - 1;
  return D.parties.map((k) => {
    const s = D.prim[k], E = s.v[0], v = s.v[L], lo = s.lo[L], hi = s.hi[L];
    return { k, E, v, lo, hi, chg: v - E, sig: lo > E || hi < E };
  });
}
const MULT = { 2: "doubled", 3: "tripled", 4: "quadrupled" };
const FRACT = [[1 / 2, "half"], [1 / 3, "a third"], [1 / 4, "a quarter"], [1 / 5, "a fifth"]];
export function votesHead(D) {
  const ms = primaryMoves(D).filter((m) => m.sig).sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg));
  if (!ms.length) return { head: "The primary vote is much where it was at the election", lead: null };
  const m = ms[0], N = NAMES[m.k];
  if (m.chg > 0) {
    const k = Math.floor(m.lo / m.E + 1e-9);
    if (k >= 2) {
      const head = cap(N.poss) + " vote has " + (MULT[k] ? "more than " + MULT[k] : "grown more than fivefold");
      return { head: head + (m.k === "onp" && k === 3 ? ", but the Coalition is enjoying a rate-rise bounce" : ""), lead: m };
    }
    return { head: N.start + (N.pl ? " are" : " is") + " up " + f1(m.chg) + " points since the election", lead: m };
  }
  const lost = 1 - m.hi / m.E, fr = FRACT.find(([f]) => lost >= f - 1e-9);
  if (fr) return { head: N.start + (N.pl ? " have" : " has") + " lost more than " + fr[1] + " of " + (N.pl ? "their" : "its") + " election vote", lead: m };
  return { head: N.start + (N.pl ? " are" : " is") + " down " + f1(-m.chg) + " points since the election", lead: m };
}
export function votesDek(D) {
  const [y, mo] = D.election.date.split("-").map(Number);
  return "% of each party’s first-preference vote since the " + MONF[mo - 1] + " " + y + " election";
}

/* the two-party chart's story: the site's rule, word for word (rd-hero.jsx
   story), read from the same monthly implied lines */
export function tppStory(D) {
  const on = D.months.on.map(([ym, a, ci95]) => ({ ym, a, ci95 })), co = D.months.imp.map(([ym, a, ci95]) => ({ ym, a, ci95 }));
  const coBy = Object.fromEntries(co.map((d) => [d.ym, d]));
  const both = on.filter((d) => coBy[d.ym]);
  if (both.length < 3) return { head: "Labor’s two-party vote against each rival", dek: "" };
  const f = both[0], l = both[both.length - 1];
  const on0 = f.a, on1 = l.a, co0 = coBy[f.ym].a, co1 = coBy[l.ym].a, gap = on1 - co1;
  /* Hand-curated headline (owner's wording, 25 Nov 2026), kept separate
     from the data-led comparison in the dek below. */
  const head = "Labor retains a narrow 2PP lead over both rivals";
  const verb = (a, b) => (b < a ? (a - b >= 10 ? "plunged" : "fallen") : "risen");
  const pc = (v) => Math.round(v) + "%";
  let dek = "Labor’s 2PP against One Nation has " + (Math.round(on0) === Math.round(on1) ? "held near " + pc(on1) + " since " + monthYear(f.ym)
    : verb(on0, on1) + " from " + pc(on0) + " in " + monthYear(f.ym) + " to " + pc(on1) + " now")
    + "; against the Coalition, " + (Math.round(co0) === Math.round(co1) ? "it has held near " + pc(co1) : "from " + pc(co0) + " to " + pc(co1)) + ".";
  let k = both.length - 1, worst = Math.abs(gap);
  while (k > 0) {
    const g = Math.abs(both[k - 1].a - coBy[both[k - 1].ym].a);
    if (Math.max(worst, g) > 1.5) break;
    worst = Math.max(worst, g); k--;
  }
  const runLen = both.length - k, phrase = pointsPhrase(Math.max(worst, 0.01));
  if (runLen >= 3 && phrase && k > 0) {
    const [yy, mm] = both[k].ym.split("-").map(Number);
    dek += " The two contests have run within " + phrase + " of each other since " + MONF[mm - 1] + (yy === Number(l.ym.slice(0, 4)) ? "" : " " + yy) + ".";
  }
  return { head, dek };
}
/* rd.jsx rdPointsPhrase */
function pointsPhrase(v) {
  if (v <= 0.5) return "half a point";
  if (v <= 1) return "a point";
  if (v <= 1.5) return "a point and a half";
  if (v <= 2) return "two points";
  if (v <= 3) return "three points";
  return null;
}

/* each contest's verdict today: { v, ci95, lead, margin, who: "alp" | rival | null } */
export function verdicts(D) {
  const L = D.tpp.imp.v.length - 1;
  /* the margin as the site prints it: twice the interval read to a tenth */
  const mk = (v, ci, rival) => {
    const ci95 = Math.round(ci * 10) / 10, lead = 2 * v - 100, margin = Math.round(20 * ci95) / 10;
    return { v, ci95, lead, margin, who: Math.abs(lead) > margin ? (lead > 0 ? "alp" : rival) : null };
  };
  return {
    lnp: mk(D.tpp.imp.v[L], D.tpp.imp.ci[L], "lnp"),
    on: mk(D.tpp.on.v[L], Math.hypot(D.tpp.on.cs[L], D.tpp.on.cf[L]), "onp"),
  };
}
const RIVAL = { lnp: "the Coalition", on: "One Nation" };
export function flowsHead(D) {
  return "Two-party preferred";
}

/* the line under the flow diagram, per contest: how preferences move the
   gap from first preferences; "inside the ±x margin" when the two-party
   lead does not clear it. shares: today's unrounded primaries. */
export function flowNote(D, c, two) {
  /* both gaps from the figures as printed, so they add up on the page */
  const sh = D.nowShares, riv = c === "lnp" ? "lnp" : "onp", V = verdicts(D)[c], R = (v) => Math.round(v * 10) / 10;
  const one = R(sh.alp) - R(sh[riv]), lead2 = R(two) - R(100 - two);
  const name = RIVAL[c], m = V.margin.toFixed(1), inside = Math.abs(lead2) <= V.margin;
  const r = (v) => f1(Math.abs(v));
  let s;
  if (one >= 0 && lead2 >= 0) s = "Preferences " + (lead2 >= one ? "widen" : "narrow") + " Labor’s lead over " + name + " from " + r(one) + " points on first preferences to " + r(lead2);
  else if (one < 0 && lead2 < 0) s = "Preferences " + (-lead2 >= -one ? "widen" : "narrow") + " " + (c === "lnp" ? "the Coalition’s" : "One Nation’s") + " lead over Labor from " + r(one) + " points on first preferences to " + r(lead2);
  else if (one < 0) s = "Preferences turn Labor’s " + r(one) + "-point deficit against " + name + " on first preferences into a " + r(lead2) + "-point lead";
  else s = "Preferences turn Labor’s " + r(one) + "-point lead over " + name + " on first preferences into a " + r(lead2) + "-point deficit";
  return s + (inside ? ", inside the ±" + m + " margin." : ".");
}

/* the leadership ratings page (assets/dawn-leaders.json). Today's leaders are
   the lines still running; since.lo and since.hi are the 95% interval of the
   change since the line's first week */
export function leaderMoves(L, series = L.series) {
  return series.filter((s) => !s.to).map((s) => ({ ...s.since, person: s.person, party: s.party, i0: s.i0, from: s.from,
    v: s.v[s.v.length - 1], start: s.v[0], sig: s.since.lo > 0 || s.since.hi < 0 }));
}
function ratingHead(L, series, what, none) {
  const m = leaderMoves(L, series).filter((x) => x.sig).sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg))[0];
  if (!m) return { head: none, lead: null };
  const since = m.from > L.election.date ? "since taking the job" : m.i0 === 0 ? "since the election" : "since " + monthYear(L.weeks[m.i0].slice(0, 7));
  return { head: m.person + "\u2019s " + what + " has " + (m.chg > 0 ? "risen " : "fallen ") + f1(Math.abs(m.chg)) + " points " + since, lead: m };
}
export const leadersHead = (L) => ratingHead(L, L.series, "net rating", "The leaders\u2019 ratings are much where they started");
export const favHead = (L) => ratingHead(L, L.fav.series, "net favourability", "The leaders\u2019 favourability is much where it started");
const sinceElection = (L) => { const [y, mo] = L.election.date.split("-").map(Number); return "since the " + MONF[mo - 1] + " " + y + " election"; };
export const leadersDek = (L) => "% approving each leader\u2019s job performance less % disapproving, " + sinceElection(L);
export const favDek = (L) => "% having a favourable opinion of each leader less % unfavourable, " + sinceElection(L);

/* a share as the nearest plain fraction a reader would say (the site's
   plainShare): "About" within half a point of it */
const PLAIN = [[1, 5], [1, 4], [1, 3], [2, 5], [1, 2], [3, 5], [2, 3], [7, 10], [3, 4], [4, 5], [9, 10]];
const COUNT = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export function plainShare(v) {
  const [a, b] = PLAIN.reduce((best, f) => (Math.abs(v - 100 * f[0] / f[1]) < Math.abs(v - 100 * best[0] / best[1]) ? f : best));
  const d = v - 100 * a / b;
  const lead = Math.abs(d) < 0.5 ? "About" : d < 0 ? "Almost" : "More than";
  return lead + " " + (a === 1 && b === 2 ? "half of" : COUNT[a] + " in " + COUNT[b]);
}
export function moodHead(M) {
  const L = M.weeks.length - 1, wrongLeads = M.wrong.v[L] >= M.right.v[L], side = wrongLeads ? M.wrong : M.right;
  const most = side.v[L] >= Math.max(...side.v) - 0.05;
  return plainShare(side.v[L]) + " say Australia is " + (wrongLeads ? "on the wrong track" : "heading in the right direction") + (most ? ", the most this term" : "");
}
export function moodDek(M) {
  const [y, mo] = M.election.date.split("-").map(Number);
  return "% saying the country is heading in the right direction and % saying it is on the wrong track, since the " + MONF[mo - 1] + " " + y + " election";
}
/* trust reads in tenths, from the nearer side (the owner's wording for 27.4: "Fewer than three in
   ten"): "Fewer than" the ten above from the half-way point up, else "More than" the ten below, and
   "About" within half a point of either */
export function tenthShare(v) {
  const near = Math.round(v / 10), under = Math.floor(v / 10);
  if (near > 0 && Math.abs(v - 10 * near) < 0.5) return "About " + COUNT[near] + " in ten";
  if (v - 10 * under >= 5 || !under) return "Fewer than " + COUNT[under + 1] + " in ten";
  return "More than " + COUNT[under] + " in ten";
}
export function trustHead(M) {
  const now = M.trust.now, low = now.low2020;
  const rank = !low ? "" : low.record ? ", the lowest on record here" : ", the lowest since " + monthYear(low.since);
  return tenthShare(now.v) + " Australians say people in government can be trusted to do the right thing" + rank;
}
export function trustDek(M) {
  const Y = M.trust.now.year;
  const change = Y.sig ? (Y.chg < 0 ? "Down " : "Up ") + f1(Math.abs(Y.chg)) + " points on a year earlier" : "Not significantly changed on a year earlier";
  return "% saying people in government can usually or sometimes be trusted to do the right thing. " + change + ".";
}

/* preferred prime minister: a leader "leads" only when the 95% interval of the lead among those who
   chose excludes zero, else the two are "level"; the opposition leader's pairing is said first */
export function ppmHead(L) {
  const pairs = L.ppm.series.filter((p) => !p.to && p.lead).sort((a, b) => (a.contest === "alb-han") - (b.contest === "alb-han"));
  if (!pairs.length) return "Preferred prime minister";
  const who = pairs.map((p) => ({ p, ahead: p.lead.lo > 0 ? p.pm : p.lead.hi < 0 ? p.opp : null }));
  if (who.length > 1 && who.every((w) => w.ahead === w.p.pm)) return who[0].p.pm + " leads both " + who.map((w) => w.p.opp).join(" and ") + " as preferred prime minister";
  const say = ({ p, ahead }) => (ahead ? ahead + " leads " + (ahead === p.pm ? p.opp : p.pm) : p.pm + " and " + p.opp + " are level");
  const [first, ...rest] = who;
  return say(first) + " as preferred prime minister" + rest.map((w) => "; " + say(w)).join("");
}
export const ppmDek = (L) => "% preferring each as prime minister, of those who chose one of the two, " + sinceElection(L);

/* ---------- past cycles (assets/dawn-cycles.json) ----------
   Every term at the month this one has reached. "Worst" is lowest: the
   biggest fall in a vote since the term's election, or the lowest leader
   figure. A party's primary vote is ranked by the share of its own starting
   vote it has lost (terms have opened anywhere from the low 30s to above
   50), with the ranks in points behind the charts' switch; the two-party
   vote and the leader figures are ranked in points. A term as low or lower
   counts against this one. The rules:
   - a vote that has not fallen: "No decline", unranked;
   - none as low: "worst on record", back to the first term with a figure;
   - half or more of past terms as low: its place, "9th worst of 30";
   - otherwise "worst since" the latest term as low, unless that is the term
     just before this one, when "second worst since" the one before that
     (or "second worst on record" where there is none).
   Ranks compare point estimates, and the page says so. */
export const CYCLE_STATS = [
  { key: "tpp", name: "Government’s two-party vote", unit: "points since the election", change: true, who: "govLead" },
  { key: "primary", name: "Government’s primary vote", unit: "points since the election", change: true, who: "govLead" },
  { key: "net", name: "PM’s net approval", unit: "net points", who: "pm" },
  { key: "ppmm", name: "PM’s lead as preferred PM", unit: "points", who: "pm" },
  { key: "oppr", name: "Opposition’s primary vote", unit: "points since the election", change: true, who: "oppParty" },
];
/* the point every term is compared at: the last of the weekly grid, the days this term has run */
export const cycleNow = (C) => C.days.length - 1;
/* the primary votes can be read in points or as a share of the starting vote */
export const SHARE_KEYS = ["primary", "oppr"];
export const cycleMode = (key) => (SHARE_KEYS.includes(key) ? "share" : "points");
/* a term's figure at point m, in either reading */
export const cycleValue = (t, key, m, mode = cycleMode(key)) => {
  const v = t[key][m];
  return v == null || mode !== "share" ? v : t.base && t.base[key] ? (100 * v) / t.base[key] : null;
};
export function cycleRank(C, key, mode = cycleMode(key)) {
  const st = CYCLE_STATS.find((s) => s.key === key), M = cycleNow(C);
  const at = (t) => ({ year: t.year, who: t[st.who], v: cycleValue(t, key, M, mode), points: t[key][M] });
  const cur = at(C.terms.find((t) => t.current));
  const past = C.terms.filter((t) => !t.current).map(at).filter((p) => p.v != null);
  const worse = cur.v == null ? [] : past.filter((p) => p.v <= cur.v);
  const out = { key, mode, cur, past: past.length, first: past.length ? past[0].year : null, worse };
  if (cur.v == null || !past.length) return { ...out, kind: "unread" };
  if (st.change && cur.v >= 0) return { ...out, kind: "gain" };
  if (!worse.length) return { ...out, kind: "record" };
  if (worse.length * 2 >= past.length) return { ...out, kind: "place", place: worse.length + 1, of: past.length + 1 };
  const last = worse[worse.length - 1];
  if (last.year !== past[past.length - 1].year) return { ...out, kind: "since", W: last };
  return { ...out, kind: "second", W: worse.length > 1 ? worse[worse.length - 2] : null };
}
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
const tag = (w) => w.year + " (" + w.who + ")";
export function cycleRankLine(r) {
  if (r.kind === "record") return "Worst on record, back to " + r.first;
  if (r.kind === "since") return "Worst since " + tag(r.W);
  if (r.kind === "second") return r.W ? "Second worst since " + tag(r.W) : "Second worst on record, back to " + r.first;
  if (r.kind === "place") return ordinal(r.place) + " worst of " + r.of + " terms";
  if (r.kind === "gain") return "No decline";
  return "Not yet read";
}
export const cycleChapeau = (C) => C.months + (C.months === 1 ? " month in:" : " months in:");

/* each chart's head: the same rank, as a sentence */
const HEADS = {
  primary: { who: "government", did: "lost this much primary vote", more: "lost more primary vote", thing: "The government’s primary vote", up: "The government’s primary vote has not fallen since the election" },
  oppr: { who: "opposition", did: "lost this much primary vote", more: "lost more primary vote", thing: "The opposition’s primary vote", up: "The opposition’s primary vote has not fallen since the election" },
  net: { who: "prime minister", did: "been rated this low", more: "been rated lower", thing: "The prime minister’s net approval" },
  ppmm: { who: "prime minister", did: "done this badly as preferred PM", more: "done worse as preferred PM", thing: "The prime minister’s preferred-PM lead" },
};
export function cycleHead(C, key, mode = cycleMode(key)) {
  const r = cycleRank(C, key, mode), H = HEADS[key], when = " " + C.months + " months in";
  const termOf = (w) => w.who + "’s " + w.year + " term";
  if (mode === "share" && r.kind !== "gain" && r.kind !== "unread") {
    const own = " share of its primary vote";
    if (r.kind === "record") return "No " + H.who + " on record has lost a bigger" + own + when;
    if (r.kind === "since") return "Not since " + termOf(r.W) + " has " + (H.who === "opposition" ? "an " : "a ") + H.who + " lost this big a" + own + when;
    if (r.kind === "second") return "Only one " + H.who + (r.W ? " since " + termOf(r.W) : " on record") + " has lost a bigger" + own + when;
    return "The share of its primary vote the " + H.who + " has lost is the " + ordinal(r.place) + " biggest of " + r.of + " terms" + when;
  }
  if (r.kind === "record") return "No " + H.who + " on record has " + H.did + when;
  if (r.kind === "since") return "Not since " + termOf(r.W) + " has a " + H.who + " " + H.did + when;
  if (r.kind === "second") return "Only one " + H.who + (r.W ? " since " + termOf(r.W) : " on record") + " has " + H.more + when;
  if (r.kind === "place") return H.thing + " is the " + ordinal(r.place) + " worst of " + r.of + " terms" + when;
  if (r.kind === "gain") return H.up + "," + when;
  return H.thing + ", term by term";
}
const CYCLE_DEKS = {
  primary: "Change in the government’s primary vote since each election, points",
  net: "The prime minister’s net approval, % approving less % disapproving",
  ppmm: "The prime minister’s lead as preferred PM, points, among those who chose one of the two",
  oppr: "Change in the opposition’s primary vote since each election, points",
};
const SHARE_DEKS = {
  primary: "Change in the government’s primary vote since each election, as a % of the vote it won there",
  oppr: "Change in the opposition’s primary vote since each election, as a % of the vote it won there",
};
/* past terms that have lost more points than this one but a smaller share, which
   only a bigger starting vote can do: the share reading names them, so the
   points they lost are never out of sight. Up to three by name, then a count. */
export function morePoints(C, key) {
  const r = cycleRank(C, key, "share"), M = cycleNow(C);
  if (r.cur.v == null || r.cur.v >= 0) return [];
  const who = CYCLE_STATS.find((s) => s.key === key).who;
  return C.terms.filter((t) => !t.current && cycleValue(t, key, M, "share") != null && t[key][M] < r.cur.points && cycleValue(t, key, M, "share") > r.cur.v)
    .map((t) => ({ year: t.year, who: t[who] }));
}
export function morePointsLine(C, key) {
  const m = morePoints(C, key), side = key === "primary" ? "government" : "opposition";
  if (!m.length) return "";
  if (m.length > 3) return m.length + " past " + side + "s lost more points by this stage, but from bigger starting votes.";
  const names = m.map((w) => w.who + "’s " + w.year + " term");
  const list = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0];
  return list + " lost more points by this stage, but from " + (m.length > 1 ? "bigger starting votes." : "a bigger starting vote.");
}
export function cycleDek(C, key, mode = cycleMode(key)) {
  const first = C.terms.find((t) => t[key].some((v, m) => m > 0 && v != null));
  const share = mode === "share" && SHARE_DEKS[key];
  const lead = (share || CYCLE_DEKS[key]) + ": the first " + C.months + " months of every term since " + (first ? first.year : "the record began");
  const more = share ? morePointsLine(C, key) : "";
  return more ? lead + ". " + more : lead;
}
/* the terms a chart brings out: this one, the last, the one its rank names,
   then the worst at this month until there are five */
export function cycleLit(C, key, mode = cycleMode(key)) {
  const M = cycleNow(C), r = cycleRank(C, key, mode), val = (t) => cycleValue(t, key, M, mode);
  const have = C.terms.filter((t) => !t.current && val(t) != null);
  const lit = [C.terms.find((t) => t.current).year];
  const add = (y) => { if (y != null && lit.length < 5 && !lit.includes(y)) lit.push(y); };
  const before = C.terms.filter((t) => !t.current);
  add(before.length ? before[before.length - 1].year : null);
  if (r.W) add(r.W.year);
  for (const t of [...have].sort((a, b) => val(a) - val(b))) add(t.year);
  return lit;
}
export function cycleStatsHtml(C) {
  const h = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const signed = (v) => (v == null ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1));
  return CYCLE_STATS.map((s) => {
    const r = cycleRank(C, s.key);
    const unit = s.key === "tpp" && C.tppRival === "onp" ? "points, now against One Nation" : s.unit;
    /* a primary vote shows its points, then the share its rank is read on */
    const share = r.mode === "share" && r.cur.v != null;
    const small = share ? "points, " + (r.cur.v > 0 ? "a gain of " : "") + Math.round(Math.abs(r.cur.v)) + "% of its " + C.election.date.slice(0, 4) + " vote" : unit;
    return `<li data-k="${s.key}"><span class="cy-k">${h(s.name)}<b>${h(cycleRankLine(r))}</b></span><span class="cy-v"><b>${signed(share ? r.cur.points : r.cur.v)}</b><small>${h(small)}</small></span></li>`;
  }).join("");
}

/* ---------- poll disagreement (disagree-data.mjs) ----------
   - the opening line: the points between the widest and narrowest pollster on
     the One Nation–Coalition split;
   - the month-by-month chart's head compares that gap now with the first month
     six pollsters or more were on it: "further apart" or "closer" only on a
     point or more's change, else "about as far apart"; "though closer than at
     <month>'s peak" where a month between ran a point or more wider;
   - the spread chart's head names the split only when its polls sit furthest
     beyond chance of all the primary measures, in points, and are beyond it
     (1.2 times, the site's line); otherwise the main site's head stands. */
export const splitGap = (rows, ym) => { const v = rows.map((r) => { const d = r.s.find((q) => q[0] === ym); return d ? d[1] : null; }).filter((x) => x != null); return v.length ? { n: v.length, gap: Math.round((Math.max(...v) - Math.min(...v)) * 10) / 10 } : { n: 0, gap: 0 }; };
export function splitMonths(P) {
  const yms = [...new Set(P.hero.flatMap((r) => r.s.map((d) => d[0])))].sort();
  const from = yms.findIndex((ym) => splitGap(P.hero, ym).n >= Math.min(6, P.hero.length));
  return yms.slice(Math.max(0, from)).map((ym) => ({ ym, ...splitGap(P.hero, ym) }));
}
const monthName = (ym, year) => MONF[+ym.slice(5, 7) - 1] + (year && ym.slice(0, 4) !== year ? " " + ym.slice(0, 4) : "");
export const splitChapeau = (P) => { const m = splitMonths(P); return f1(m[m.length - 1].gap) + " points apart:"; };
export function splitHead(P) {
  const m = splitMonths(P);
  if (m.length < 2) return "Where each pollster sits on the One Nation–Coalition split";
  const first = m[0], now = m[m.length - 1], d = now.gap - first.gap, year = now.ym.slice(0, 4);
  const peak = m.reduce((a, b) => (b.gap > a.gap ? b : a));
  const was = d >= 1 ? "further apart on the split than in " : d <= -1 ? "closer on the split than in " : "about as far apart on the split as in ";
  const tail = peak.gap - now.gap >= 1 && peak.ym !== first.ym && d > -1 ? ", though closer than at " + monthName(peak.ym, year) + "’s peak" : "";
  return "Pollsters are " + was + monthName(first.ym, year) + tail;
}
export function splitDek(P) {
  const m = splitMonths(P), first = m[0], now = m[m.length - 1];
  return "Each pollster’s lean on One Nation’s lead over the Coalition, points, month by month. The widest and narrowest were " + f1(first.gap) + " points apart in " + monthName(first.ym, now.ym.slice(0, 4)) + " and are " + f1(now.gap) + " now.";
}
export function spreadNow(P) {
  return P.spread.primary.map((s) => { const l = s.m[s.m.length - 1]; return l ? { id: s.id, name: s.name, sigma: l[1], floor: l[2], R: l[1] / l[2], excess: Math.sqrt(Math.max(0, l[1] * l[1] - l[2] * l[2])) } : null; }).filter(Boolean);
}
export function spreadHead(P) {
  const rows = spreadNow(P), top = [...rows].sort((a, b) => b.excess - a.excess)[0];
  return top && top.id === "split" && top.R >= 1.2 ? "Pollsters differ most on One Nation v the Coalition" : P.siteHead;
}
export function spreadDek(P) {
  const by = Object.fromEntries(spreadNow(P).map((r) => [r.id, r])), sp = by.split, sum = by.rd_right;
  if (!sp) return "How far a typical poll sits from the site’s estimate, against chance alone.";
  let s = "On that split, a typical poll sits " + f1(sp.sigma) + " points from the site’s estimate; chance alone would put it " + f1(sp.floor) + " away.";
  if (sum && sum.R >= 1.2) s += " The two parties’ combined vote also varies more than chance allows.";
  return s;
}

/* ---------- electoral map (emap-data.mjs) ----------
   - the opening line names the largest group's seats: "won" at the election,
     "holds" for the House as it sits;
   - the map's head says a majority only when that group has more than half;
   - the closest-seats head counts the seats with a margin (the winner's final
     two-candidate share over 50) under a point, and names the closest with
     its lead in votes. */
const SEAT_NAMES = { alp: "Labor", lnp: "the Coalition", grn: "the Greens", onp: "One Nation", ind: "independents", oth: "others" };
export function seatLeader(seats) {
  const [k, n] = Object.entries(seats).sort((a, b) => b[1] - a[1])[0];
  return { k, n, total: Object.values(seats).reduce((t, v) => t + v, 0) };
}
export function emapChapeau(E) { const l = seatLeader(E.history[E.history.length - 1].seats); return cap(SEAT_NAMES[l.k]) + " won " + l.n + " of " + l.total + " seats:"; }
export function emapHead(E) {
  const seats = E.history[E.history.length - 1].seats, l = seatLeader(seats), need = Math.floor(l.total / 2) + 1;
  const [, second] = Object.entries(seats).sort((a, b) => b[1] - a[1]);
  return l.n >= need ? cap(SEAT_NAMES[l.k]) + " won a majority: " + l.n + " seats to " + SEAT_NAMES[second[0]] + "’s " + second[1] : "No party won a majority in the House";
}
export const closestSeats = (E, n = 10) => [...E.seats].sort((a, b) => a.m - b.m).slice(0, n);
export function closestHead(E) {
  const under = E.seats.filter((s) => s.m < 1).length, c = closestSeats(E, 1)[0];
  const votes = c.votes.toLocaleString("en-AU") + (c.votes === 1 ? " vote" : " votes");
  if (!under) return "The closest seat was " + c.n + ", won by " + votes;
  const NUM = ["", "One seat had a margin", "Two seats had margins", "Three seats had margins", "Four seats had margins", "Five seats had margins", "Six seats had margins", "Seven seats had margins", "Eight seats had margins", "Nine seats had margins", "Ten seats had margins"];
  return (NUM[under] || under + " seats had margins") + " under a point; the closest, " + c.n + ", came down to " + votes;
}

export function copyFor(D) {
  const st = tppStory(D);
  return {
    asOf: fdate(D.asOf),
    votesHead: votesHead(D).head, votesDek: votesDek(D),
    tppHead: st.head, tppDek: st.dek,
    flowsHead: flowsHead(D),
  };
}

/* the public opinion page's lede: what is on it and how fresh it is, counted from the page's own data
   (the Australian Election Study is counted apart, as the catalogue counts it) */
export function opinionLede(src, newest) {
  const houses = Object.keys(src.houses).filter((h) => !src.longRun || h !== src.longRun.house).length;
  const topics = src.topics.filter((t) => t.blocks.length || t.more.length).length;
  return "What else Australians tell the pollsters: " + src.counts.questions + " questions from " + houses + " pollsters, in " + topics + " topics."
    + (newest ? " The newest was published on " + fdate(newest) + "." : "");
}
