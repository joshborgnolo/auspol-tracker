// Victorian polls in the MAIN page's dataset shape (2026-10-05).
//
// /vic/ is built by the main page's own pipeline — gen-data.mjs, build.mjs
// and the rd-* views — run on a Victorian dataset, instead of the separate
// refresh-vic.mjs page (user call 2026-10-05: the Victorian page should have
// the main page's functionality and appearance; the 2PP is derived "fully
// identical to the main page", from primaries through preference flows).
// The curated source stays data/vic-polls.json (assembled by vic-watch.mjs,
// its own schema); this module maps it onto data/polls.json's shape so every
// main-page estimator, chart and table reads it unchanged.
//
// What a federal dataset has that this one sets differently, all in
// `jurisdiction` (gen-data and the views fall back to the federal values when
// it is absent, so the federal page is untouched):
//   - the baseline election (2022, VEC) and the next (28 Nov 2026, fixed date)
//   - the leader slots: the main page's `alb` (head of government), `opp`
//     (opposition leader) and `han` (One Nation leader) carry the Premier,
//     the Opposition Leader and One Nation's Victorian leader, with each
//     slot's eras (Andrews → Allan → Carroll; Pesutto → Battin → Wilson;
//     Pickering from Aug 2026)
//   - the preference flows, measured from the VEC's 2022 district counts
//     (see FLOWS below)
//   - the words the views use for the office and the jurisdiction.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Preference flows to Labor, Labor v Coalition, from the 2022 Victorian
   election. The VEC publishes no flow table (the AEC's federal TPP-flow file
   has no state twin), so they were measured 2026-10-05 from its own counts:
   each district's first preferences (vec.vic.gov.au district results pages,
   87 of 88 — Narracan went to a supplementary poll) against its two-party
   preferred (the VEC's "Two-party-preferred results – all districts"
   workbook), weighted least squares of (ALP 2PP − ALP primary) on the Greens
   and remaining-minor shares. Fit on the 38 districts the VEC decided by a
   classic Labor-v-Coalition preference distribution (the other 49 are
   notional 2PP / 2CP counts): Greens 0.860, others 0.478 (s.e. ~0.02). (All
   87 districts give 0.96 / 0.43 and overshoot the statewide result by half a
   point.) The others cell is then set so the OFFICIAL statewide primaries
   below (VEC, incl. Narracan) read to the official 55.0 exactly, as the
   federal table reproduces its own count: 0.491, inside the fit's error.
   One Nation ran in too few districts in 2022 to be measured (0.28% of the
   vote), so its flow is the federal 2025 count's, 0.255 — the user's call
   ("fully identical to the main page", borrowing an ONP flow). The
   three-cornered leak term is folded into the fitted constants. */
export const VIC_FLOWS = Object.freeze({ grn: 0.860, onp: 0.255, oth: 0.491, threeCorner: 0 });

const VIC_ELECTION_2022 = {
  date: "2022-11-26",
  // VEC final count incl. the Narracan supplementary (refresh-vic.mjs record)
  alp: 36.66, lnp: 34.48, grn: 11.5, onp: 0.28, oth: 17.08,
  tpp_alp: 55.0, tpp_lnp: 45.0,
};

// each slot's office-holders, inclusive date ranges (Wikipedia, 2026-10-05)
export const VIC_ERAS = {
  alb: [
    { key: "andrews", name: "Andrews", full: "Daniel Andrews", from: "2022-11-26", to: "2023-09-26" },
    { key: "allan", name: "Allan", full: "Jacinta Allan", from: "2023-09-27", to: "2026-07-27" },
    { key: "carroll", name: "Carroll", full: "Ben Carroll", from: "2026-07-28", to: null },
  ],
  opp: [
    { key: "pesutto", name: "Pesutto", full: "John Pesutto", from: "2022-12-08", to: "2024-12-26" },
    { key: "battin", name: "Battin", full: "Brad Battin", from: "2024-12-27", to: "2025-11-17" },
    { key: "wilson", name: "Wilson", full: "Jess Wilson", from: "2025-11-18", to: null },
  ],
  han: [
    { key: "pickering", name: "Pickering", full: "Warren Pickering", from: "2026-08-02", to: null },
  ],
};

const VIC_EVENTS = [
  { date: "2023-09-27", short: "Allan Premier", label: "Jacinta Allan becomes Premier", desc: "Daniel Andrews resigns; Jacinta Allan is elected Labor leader and sworn in as Premier.", major: true },
  { date: "2024-12-27", short: "Battin leads Libs", label: "Brad Battin becomes Liberal leader", desc: "A party-room spill replaces John Pesutto with Brad Battin as Opposition Leader.", major: false },
  { date: "2025-11-18", short: "Wilson leads Libs", label: "Jess Wilson becomes Liberal leader", desc: "Jess Wilson replaces Brad Battin as Liberal leader and Opposition Leader.", major: false },
  { date: "2026-07-28", short: "Carroll Premier", label: "Ben Carroll becomes Premier", desc: "Jacinta Allan steps down; Ben Carroll is elected unopposed as Labor leader and becomes Premier.", major: true },
  { date: "2026-08-02", short: "Pickering leads ON", label: "Warren Pickering leads One Nation in Victoria", desc: "One Nation names Warren Pickering its Victorian leader for the state election.", major: false },
];

// house names as the main page spells them (one house, one name). Every
// Victorian Roy Morgan poll is an SMS poll – "Snap SMS Poll" (May and July
// 2023), "special SMS Roy Morgan survey" (Feb, Apr, Aug 2026), per each
// release – so it files as the federal page files Roy Morgan's SMS polls:
// "Roy Morgan (SMS)", in the archive and out of every aggregate (gen-data's
// NO_AGG_HOUSES: SMS polls have a strong selection bias)
const HOUSE = {
  "Resolve": "Resolve", "RedBridge/Accent": "RedBridge/Accent", "DemosAU/Premier National": "DemosAU",
  "Freshwater": "Freshwater", "Roy Morgan": "Roy Morgan (SMS)", "Newspoll": "Newspoll",
  "Wolf & Smith": "Wolf & Smith", "YouGov (MRP)": "YouGov (MRP)",
};
const FIRM_KEY_TO_HOUSE = {
  resolve: "Resolve", "redbridge-accent": "RedBridge/Accent", demosau: "DemosAU", freshwater: "Freshwater",
  roymorgan: "Roy Morgan (SMS)", newspoll: "Newspoll", "wolf-smith": "Wolf & Smith", "yougov-mrp": "YouGov (MRP)",
};

const eraAt = (slot, iso) => (VIC_ERAS[slot] || []).find((e) => iso >= e.from && (!e.to || iso <= e.to)) || null;
const eraByKey = (slot, key) => (VIC_ERAS[slot] || []).find((e) => e.key === key) || null;

/* The jurisdiction descriptor gen-data and the views read (absent federally). */
export const VIC_JURISDICTION = {
  id: "vic",
  name: "Victoria",
  // the wordmark's first word and the tagline's election (user call
  // 2026-10-05: "just replace aus with vic" – vicpol tracker; "Victorian
  // state" for "Australian federal")
  brand: "vicpol",
  electionWords: "Victorian state",
  adj: "Victorian",                 // "166 Victorian polls", "the Victorian election"
  place: "statewide",               // where the federal copy says "national"
  baseline: "e2022",
  // Victorian houses folded One Nation into "others" until it surged in late
  // 2025: those waves still read to an implied 2PP (their ON voters pass
  // through the others flow), where the federal rule needs an ON figure
  onpOptional: true,
  nextElection: { date: "2026-11-28", fixed: true, label: "Saturday 28 November 2026" },
  office: { alb: "Premier", albLong: "Premier of Victoria", opp: "Opposition Leader", han: "One Nation leader" },
  preferredWord: "preferred Premier",
  flows: VIC_FLOWS,
  flowsLabel: "the 2022 Victorian election's flows (measured from the VEC's district counts; One Nation's from the 2025 federal count)",
  eras: VIC_ERAS,
  /* The lines are a Kalman smoother's trend (gen-data §1a, kalman.mjs) – user
     call 2026-10-06 "proceed as recommended", after a trial found it halves
     the monthly lines' jumps at no cost in predicting the next poll, given
     Victoria's own smoothness. s: how far the trend may drift in a day (sd,
     points); tau: extra noise a poll carries beyond sampling error. Each is
     the maximum-likelihood fit on Victoria's own polls as at 28 Sep 2026;
     gen-data logs a refit beside them every build, and changing them is a
     hand call. jumpSd: how far opinion may move at once on a
     change of Premier or Opposition Leader. leanSd: the prior on each
     pollster's lean (the site's shrinkage, about 1.5 polls' worth). */
  kalman: {
    jumpSd: 2,
    leanSd: 1.6,
    series: {
      tpp: { s: 0.16, tau: 0 },       // the pollsters' published 2PPs
      imp: { s: 0.2, tau: 0 },        // the implied 2PP (and its flow-sensitivity edge)
      on: { s: 0.16, tau: 0 },        // Labor v One Nation, implied
      alp: { s: 0.25, tau: 0.5 },
      lnp: { s: 0.3, tau: 0 },
      grn: { s: 0.03, tau: 0 },
      onp: { s: 0.5, tau: 1.5 },
      oth: { s: 0.25, tau: 0 },
    },
  },
  path: "/vic/",
};

export function vicToMain(src) {
  const polls = [], ppm = [], approval = [], altTpp = [];
  for (const r of src.polls) {
    const pollster = HOUSE[r.firmRaw] || r.firmRaw;
    const q = r.primary || {};
    // a source that merged independents into one Others cell: the whole
    // remainder rides in `ind` with oth null, the federal convention
    const merged = q.ind == null;
    const row = {
      // a one-day poll carries no start, as the federal data's do ("13 Sep",
      // never "13–13 Sep")
      date: r.fwEnd, dateStart: r.fwStart && r.fwStart !== r.fwEnd ? r.fwStart : null, pollster,
      client: r.client || (r.firmRaw === "DemosAU/Premier National" ? "Premier National" : null),
      sample: r.sample,
      alp: q.alp ?? null, lnp: q.lnp ?? null, grn: q.grn ?? null, onp: q.onp ?? null,
      ind: merged ? (q.oth ?? null) : q.ind, oth: merged ? null : (q.oth ?? null),
      tpp_alp: r.tpp2 && r.tpp2.alp != null ? r.tpp2.alp : null,
      tpp_lnp: r.tpp2 && r.tpp2.alp != null ? Math.round((100 - r.tpp2.alp) * 10) / 10 : null,
      ...(r.approxDate ? { approxDate: true, dateLabel: r.dateLabel } : {}),
      url: r.sourceUrl || null,
    };
    polls.push(row);
    if (r.alt && (r.alt.alpVOnp != null || r.alt.lnpVOnp != null))
      altTpp.push({ date: row.date, firm: pollster, alpVsOnp_alp: r.alt.alpVOnp ?? null, lnpVsOnp_lnp: r.alt.lnpVOnp ?? null });
  }
  // leadership: the source keys each row by leader; the main shape keys a
  // wave's slots (alb/opp/han) with the opposition leader named per row
  const waveKey = (l) => (l.date || l.fwEnd) + "|" + (FIRM_KEY_TO_HOUSE[l.firm] || l.firm);
  const appr = new Map();
  for (const l of src.leadership) {
    const date = l.date || l.fwEnd, firm = FIRM_KEY_TO_HOUSE[l.firm] || l.firm;
    const [pmKey, oppKey, hanKey] = String(l.pair || "").split("-vs-");
    if (l.series === "preferredPremier") {
      const v = l.values || {};
      ppm.push({ date, firm, alb: v[pmKey] ?? null, opp: v[oppKey] ?? null,
        oppName: (eraByKey("opp", oppKey) || {}).name || null, pmName: (eraByKey("alb", pmKey) || {}).name || null,
        han: hanKey ? (v[hanKey] ?? null) : null, extra: null });
    } else if (l.series === "approval") {
      const k = waveKey(l);
      const a = appr.get(k) || { date, firm, alb: null, opp: null, oppName: null, pmName: null, han: null, detail: {} };
      const slot = l.leader === pmKey ? "alb" : l.leader === oppKey ? "opp" : l.leader === hanKey ? "han" : null;
      if (slot) {
        a[slot] = l.net ?? (l.pos != null && l.neg != null ? Math.round((l.pos - l.neg) * 10) / 10 : null);
        if (l.pos != null && l.neg != null) a.detail[slot] = { app: l.pos, dis: l.neg };
        if (slot === "opp") a.oppName = (eraByKey("opp", l.leader) || {}).name || null;
        if (slot === "alb") a.pmName = (eraByKey("alb", l.leader) || {}).name || null;
      }
      appr.set(k, a);
    }
  }
  for (const a of appr.values()) {
    if (!Object.keys(a.detail).length) a.detail = null;
    approval.push(a);
  }
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return {
    $comment: "GENERATED by .build/vic/to-main-schema.mjs from data/vic-polls.json — never hand-edited",
    jurisdiction: VIC_JURISDICTION,
    meta: { source: "data/vic-polls.json", generated: src.generated },
    metricRules: { favFirms: ["redbridge", "demosau", "freshwater"], overrides: {} },
    // every house needs an entry (validate.mjs); release habits are measured
    // from the data by the cadence code, so nothing is declared yet
    pollsterRules: Object.fromEntries([...new Set(polls.map((p) => p.pollster))].sort().map((h) => [h, {}])),
    elections: { e2022: VIC_ELECTION_2022 },
    events: VIC_EVENTS,
    direction: [],
    polls: polls.sort(byDate),
    ppm: ppm.sort(byDate),
    approval: approval.sort(byDate),
    ppmHeadToHead: [],
    altTpp: altTpp.sort(byDate),
    cyclePolls: {}, cycleApproval: {}, cyclePollBases: {},
  };
}

export const eraOfSlot = eraAt;

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const out = vicToMain(JSON.parse(readFileSync(process.argv[2] || "data/vic-polls.json", "utf8")));
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}
