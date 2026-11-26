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

export function copyFor(D) {
  const st = tppStory(D);
  return {
    asOf: fdate(D.asOf),
    votesHead: votesHead(D).head, votesDek: votesDek(D),
    tppHead: st.head, tppDek: st.dek,
    flowsHead: flowsHead(D),
  };
}
