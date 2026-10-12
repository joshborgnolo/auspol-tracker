/* changelog.mjs – the refresh change log behind the Info tab's "Change log"
   section. gen-data.mjs §8c computes the site's headline state on every
   build; a real site refresh (AUSPOL_SITE_REFRESH=1, set only by
   .build/git-push-main.sh's refresh_site) diffs it against the committed
   data/changelog.json and appends entries when something moved:
     - poll      — new waves landed, and what the 2PP estimate did
     - flows     — the flows.mjs preference-flow assumptions changed
     - finding   — a statistical finding appeared or fell away (the Who
                   votes for whom proportionality breaks; the 2PP's own
                   month-on-month significance)
     - meta      — the headline pairing or basis switched
     - seed      — the day recording began
   Pure functions, no fs: gen-data hands in the parsed committed file and
   writes what comes back. Pinned by .build/test-changelog.mjs. */
import { createHash } from "node:crypto";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const isoLabel = (iso) => `${+iso.slice(8, 10)} ${MONTH_SHORT[+iso.slice(5, 7) - 1]}`;
/* an entry's display date carries its year – the log outlives a year, and
   "12 Oct" alone stops saying which one (before 2026-10-12 it did) */
export const isoLabelYear = (iso) => `${isoLabel(iso)} ${iso.slice(0, 4)}`;
export const isoLabelLong = (iso) => `${+iso.slice(8, 10)} ${MONTH_LONG[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;

const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const r1 = (v) => Math.round(v * 10) / 10;

export const PARTY_NAME = {
  alp: "Labor", lnp: "the Coalition", grn: "the Greens",
  onp: "One Nation", oth: "others", ind: "independents",
};
const pairName = (pair) => (pair === "alp_on" ? "Labor v One Nation" : "Labor v the Coalition");
const basisName = (basis) => (basis === "imp" ? "implied flows" : "published figures");

/* The flows summary, hashed so any change to flows.mjs's tables (the counted
   FLOW set, or the ALP-v-ON FP_ON set and its band) registers as a `flows`
   entry next refresh; the summary doubles as the entry text's figures. */
export function flowsOf(flow, fpOn, band) {
  const summary = {
    grn: r1(flow.grn * 100), onp: r1(flow.onp * 100), oth: r1(flow.oth * 100),
    on: { lnp: r1(fpOn.lnp * 100), grn: r1(fpOn.grn * 100), oth: r1(fpOn.oth * 100) },
    /* flows.mjs's FP_ON_BAND is per cell ({lnp, grn, oth}); a bare number
       is still read as one band for all three. Before 2026-10-12 the object
       was multiplied as a number – NaN, stored as null – so band edits never
       registered; diffChangelog compares bands only when both sides have
       one, so the old null state migrates without a phantom entry. */
    band: band == null ? null
      : typeof band === "number" ? r1(band * 100)
      : Object.fromEntries(["lnp", "grn", "oth"].filter((k) => band[k] != null).map((k) => [k, r1(band[k] * 100)])),
  };
  return { ...summary, hash: createHash("sha1").update(JSON.stringify(summary)).digest("hex").slice(0, 12) };
}

/* Canonical state. Everything is rounded at the boundary so a recomputation
   from identical data is byte-identical: identical state ⇒ no entries, and
   gen-data leaves the committed file untouched (quiet refreshes must not
   dirty the tree or the unattended jobs refuse to run). */
export function stateOf(raw) {
  return {
    lead: raw.lead && raw.lead.alp != null
      ? { pair: raw.lead.pair, basis: raw.lead.basis, alp: r1(raw.lead.alp) }
      : null,
    imp: raw.imp != null ? r1(raw.imp) : null,
    pub: raw.pub != null ? r1(raw.pub) : null,
    on: raw.on != null ? r1(raw.on) : null,
    momSig: !!raw.momSig,
    flows: raw.flows || null,
    polls: [...(raw.polls || [])].sort(),
    moves: Object.fromEntries(Object.entries(raw.moves || {}).sort(([a], [b]) => (a < b ? -1 : 1))),
    movesMeta: Object.fromEntries(Object.entries(raw.movesMeta || {}).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
}

/* `url` for a one-poll entry; `links` ([{name, url}], one per poll that has
   a release) when several polls land in one entry – a single link there
   named only the first */
const entry = (iso, kind, text, url, links) => ({
  date: iso, label: isoLabelYear(iso), kind, text,
  ...(url ? { url } : {}),
  ...(links && links.length ? { links } : {}),
});

/* Polls are known by "date|pollster" – polls.json carries no id – so a
   corrected end date or a house rename makes a key vanish and another
   appear. Pair each such appearance with a vanished key of the same house
   (the same name, or the name HOUSE_RENAMES maps the old one to) within
   CORRECTION_DAYS, nearest first: those are corrections, not new polls,
   and log nothing. What is left over is genuinely new. */
const CORRECTION_DAYS = 7;
export function newPollKeys(prevKeys, nextKeys, renames = {}) {
  const prev = new Set(prevKeys || []);
  const added = (nextKeys || []).filter((k) => !prev.has(k)).sort();
  const next = new Set(nextKeys || []);
  const gone = (prevKeys || []).filter((k) => !next.has(k));
  const split = (k) => { const i = k.indexOf("|"); return [k.slice(0, i), k.slice(i + 1)]; };
  const days = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;
  const used = new Set();
  return added.filter((k) => {
    const [d, house] = split(k);
    let best = null, bestGap = Infinity;
    for (const g of gone) {
      if (used.has(g)) continue;
      const [gd, gh] = split(g);
      if ((renames[gh] || gh) !== house) continue;
      const gap = days(d, gd);
      if (gap <= CORRECTION_DAYS && gap < bestGap) { best = g; bestGap = gap; }
    }
    if (best) { used.add(best); return false; }
    return true;
  });
}

export function initChangelog(nextState, iso) {
  const leadTxt = nextState.lead
    ? ` — the two-party preferred estimate is ${f1(nextState.lead.alp)} (${pairName(nextState.lead.pair)}, ${basisName(nextState.lead.basis)})`
    : "";
  return {
    state: nextState,
    entries: [entry(iso, "seed",
      `The change log starts here${leadTxt}. From today, every movement it makes and every statistical finding that comes or goes is recorded here.`)],
  };
}

/* "moved 52.2 → 52.3", or "held at 52.3", or null when either side is
   missing (a basis that only just appeared has nothing to move FROM). */
const moveTxt = (a, b) => {
  if (a == null || b == null) return null;
  return f1(a) === f1(b) ? `held at ${f1(b)}` : `moved ${f1(a)} → ${f1(b)}`;
};
const leadClause = (prev, next) => {
  const t = prev && next && prev.pair === next.pair && prev.basis === next.basis ? moveTxt(prev.alp, next.alp) : null;
  if (!t) return next ? `the estimate reads ${f1(next.alp)} (${pairName(next.pair)}, ${basisName(next.basis)})` : null;
  return `the two-party preferred estimate ${t} (${pairName(next.pair)}, ${basisName(next.basis)})`;
};

/* prevState / nextState as canonicalised by stateOf; committed entries are
   returned in `entries` with any new ones appended. pollInfo maps each new
   poll's "date|pollster" key to { name, fw, sample, url }. */
export function diffChangelog(prevState, committed, nextState, iso, pollInfo = {}, renames = {}) {
  const appended = [];
  const addedKeys = newPollKeys(prevState.polls, nextState.polls, renames);

  /* the headline pairing or its basis switched */
  if (prevState.lead && nextState.lead &&
      (prevState.lead.pair !== nextState.lead.pair || prevState.lead.basis !== nextState.lead.basis)) {
    if (prevState.lead.pair !== nextState.lead.pair) {
      appended.push(entry(iso, "meta",
        `The headline pairing is now ${pairName(nextState.lead.pair)} (it was ${pairName(prevState.lead.pair)}); the estimate reads ${f1(nextState.lead.alp)} (${basisName(nextState.lead.basis)}).`));
    } else {
      appended.push(entry(iso, "meta",
        `The headline two-party figure is now on ${basisName(nextState.lead.basis)} (it was on ${basisName(prevState.lead.basis)}); the estimate reads ${f1(nextState.lead.alp)}.`));
    }
  }

  /* the preference-flow assumptions moved: every figure that changed,
     both tables, then what the headline did (and the implied Labor v the
     Coalition figure too when the headline is another pairing and the
     counted table moved). Decided on the figures, not the hash, so a
     change of the state's own shape never logs an empty update. */
  if (prevState.flows && nextState.flows && prevState.flows.hash !== nextState.flows.hash) {
    const A = prevState.flows, B = nextState.flows, bits = [];
    const cmp = (a, b, lab, unit = "%") => {
      if (a != null && b != null && f1(a) !== f1(b)) bits.push(`${lab} ${f1(a)}${unit} → ${f1(b)}${unit}`);
    };
    for (const [k, lab] of [["grn", "Greens voters' preferences to Labor"], ["onp", "One Nation voters' preferences to Labor"], ["oth", "other voters' preferences to Labor"]]) cmp(A[k], B[k], lab);
    const classicMoved = bits.length > 0;
    for (const [k, lab] of [["lnp", "Coalition"], ["grn", "Greens"], ["oth", "other"]]) {
      cmp(A.on && A.on[k], B.on && B.on[k], `${lab} voters' preferences to Labor over One Nation`);
    }
    const bandOf = (b, k) => (b == null ? null : typeof b === "number" ? b : b[k]);
    if (A.band != null && B.band != null) {
      for (const [k, lab] of [["lnp", "Coalition"], ["grn", "Greens"], ["oth", "other"]]) {
        const a = bandOf(A.band, k), b = bandOf(B.band, k);
        if (a != null && b != null && f1(a) !== f1(b)) bits.push(`the doubt allowed on ${lab} voters' flow to Labor over One Nation ±${f1(a)} → ±${f1(b)} points`);
      }
    }
    if (bits.length) {
      /* polls landing the same refresh move the estimate too, so the poll
         entry reports the move (once, crediting this update) and this one
         lists the figures alone */
      const lead = addedKeys.length ? null : leadClause(prevState.lead, nextState.lead);
      const headlineIsClassicImp = nextState.lead && nextState.lead.pair === "alp_lnp" && nextState.lead.basis === "imp";
      const imp = !addedKeys.length && classicMoved && !headlineIsClassicImp && prevState.imp != null && nextState.imp != null
        ? ` The implied-basis Labor v the Coalition estimate ${moveTxt(prevState.imp, nextState.imp)}.` : "";
      appended.push(entry(iso, "flows",
        `The preference-flow assumptions were updated: ${bits.join("; ")}.` +
        (lead ? ` ${lead[0].toUpperCase()}${lead.slice(1)}.` : "") + imp));
    }
  }

  /* polls added since the last logged state (addedKeys, above: corrections
     already paired off) */
  if (addedKeys.length) {
    const ps = addedKeys.map((k) => pollInfo[k] ||
      { name: (k.split("|")[1] || k), fw: null, sample: null, url: null });
    /* gen-data's fw is either a range ("8–10 Oct") or the whole phrase
       "fieldwork dates TBC" – prefix only the range */
    const descr = (p) => `${p.name}` + (p.fw
      ? ` (${/^fieldwork\b/.test(p.fw) ? p.fw : `fieldwork ${p.fw}`}${p.sample != null ? `, n=${p.sample.toLocaleString("en-AU")}` : ""})`
      : "");
    const flowsToo = appended.some((e) => e.kind === "flows");
    const clause0 = leadClause(prevState.lead, nextState.lead);
    const clause = clause0 && flowsToo ? `${clause0}, with the preference-flow update the same day` : clause0;
    const text = ps.length === 1
      ? `${descr(ps[0])} added` + (clause ? ` — ${clause}.` : ".")
      : `${ps.length} polls added — ${ps.map(descr).join("; ")}` + (clause ? ` — ${clause}.` : ".");
    if (ps.length === 1) appended.push(entry(iso, "poll", text, ps[0].url || null));
    else appended.push(entry(iso, "poll", text, null, ps.filter((p) => p.url).map((p) => ({ name: p.name, url: p.url }))));
  }

  /* the two-party's month-on-month significance flipped */
  if (prevState.momSig !== nextState.momSig) {
    appended.push(entry(iso, "finding", nextState.momSig
      ? "The two-party preferred's move over the past month is now statistically significant (implied basis)."
      : "The two-party preferred's month-on-month move is no longer statistically significant (implied basis)."));
  }

  /* Who votes for whom proportionality-break findings came or went */
  const prevMoves = prevState.moves || {}, nextMoves = nextState.moves || {};
  const metaOf = (k) => nextState.movesMeta[k] || prevState.movesMeta[k] || {};
  /* demoTrend's set labels mix "Education" and "By state" forms - the parenthesis
     wants the bare dimension name either way */
  const whoOf = (k) => {
    const m = metaOf(k);
    const party = PARTY_NAME[m.party] || m.party || k.split("|")[0];
    const set = m.setLabel ? m.setLabel.toLowerCase().replace(/^by /, "") : null;
    const who = `${m.group || k.split("|")[2] || "?"}${set ? ` voters (by ${set})` : " voters"}`;
    return { party, who };
  };
  for (const k of Object.keys(nextMoves).sort()) {
    const { party, who } = whoOf(k);
    const dir = nextMoves[k];
    if (prevMoves[k] === dir) continue;
    const toward = dir > 0;
    if (prevMoves[k] != null) {
      /* a direction flip: the old finding ended and a new one began */
      appended.push(entry(iso, "finding",
        `${who} no longer break significantly ${prevMoves[k] > 0 ? "toward" : "away from"} ${party}, relative to all voters.`));
    }
    appended.push(entry(iso, "finding",
      `${who} now break significantly ${toward ? "toward" : "away from"} ${party}, relative to all voters.`));
  }
  for (const k of Object.keys(prevMoves).sort()) {
    if (nextMoves[k] != null) continue;
    const { party, who } = whoOf(k);
    appended.push(entry(iso, "finding",
      `${who} no longer break significantly ${prevMoves[k] > 0 ? "toward" : "away from"} ${party}, relative to all voters.`));
  }

  return {
    state: nextState,
    entries: [...committed, ...appended],
    appended,
  };
}
