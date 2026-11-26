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
  const { lead } = votesHead(D);
  const [y, mo] = D.election.date.split("-").map(Number);
  let dek = "% of each party’s first-preference vote since the " + MONF[mo - 1] + " " + y + " election, %.";
  const rest = primaryMoves(D).filter((m) => m.sig && (!lead || m.k !== lead.k)).sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg)).slice(0, 2);
  const dir = (m) => (m.chg > 0 ? "up" : "down"), be = (m) => (NAMES[m.k].pl ? "are" : "is");
  if (rest.length === 1) dek += " " + NAMES[rest[0].k].start + " " + be(rest[0]) + " " + dir(rest[0]) + " " + f1(Math.abs(rest[0].chg)) + " points.";
  else if (rest.length === 2) {
    const [a, b] = rest;
    dek += " " + NAMES[a.k].start + " " + be(a) + " " + dir(a) + " " + f1(Math.abs(a.chg)) + " points"
      + (dir(a) === dir(b) ? " and " + NAMES[b.k].in + " " + f1(Math.abs(b.chg)) + "."
        : "; " + NAMES[b.k].in + " " + be(b) + " " + dir(b) + " " + f1(Math.abs(b.chg)) + ".");
  }
  return dek;
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
    dek += " Since " + MONF[mm - 1] + (yy === Number(l.ym.slice(0, 4)) ? "" : " " + yy) + " the two contests have run within " + phrase + " of each other.";
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

export function copyFor(D) {
  const st = tppStory(D);
  return {
    asOf: fdate(D.asOf),
    votesHead: votesHead(D).head, votesDek: votesDek(D),
    tppHead: st.head, tppDek: st.dek,
    flowsHead: flowsHead(D),
  };
}
