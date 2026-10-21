// rm-direction-parse.mjs — pure parsers for Roy Morgan's national-direction
// "Analysis by …" prose in each fortnightly federal-VI release. No I/O:
// each parser takes the release content AFTER clean() (extract-common.mjs —
// entities decoded, curly quotes straightened), the same text parseRelease
// in extract-roymorgan.mjs reads. Shared by extract-roymorgan-direction.mjs
// and test-roymorgan-direction.mjs.
//
// The three blocks the releases print (proven by the six committed caches
// 10328 → 10366, 31 Aug – 12 Oct 2026):
//
//   Analysis by gender — two sentences, every figure named:
//     "Analysis by gender shows 60% of men and 58% of women say Australia is
//      'going in the wrong direction'. In contrast, only 29% of men and just
//      27% of women say Australia is 'going in the right direction'."
//
//   Analysis by voting intention — a wrong-direction list (order varies —
//     10343 lists Greens before the Independents) plus an ALP contrast
//     sentence that carries BOTH shares:
//     "Analysis by voting intention shows a majority of One Nation
//      supporters (92%), L-NP Coalition supporters (72%), Other Party
//      supporters (69%), Independent supporters (56%), and Greens supporters
//      (53%) say that the country is 'going in the wrong direction'. In
//      contrast, only 26% of ALP supporters say the country is 'going in
//      the wrong direction' – a majority of 57% say the country is 'going
//      in the right direction'."
//     The Independent group also prints as "supporters of Independent
//     candidates (63%)" (10353), "a clear plurality of supporters of
//     Independent candidates (50%)" (10343); ALP's right share is "a slim
//     majority of 54%" on softer weeks.
//
//   Analysis by state — extremes ONLY (Roy Morgan's full state table is
//     paywalled — "For detailed analysis such as by States … contact
//     Julian McCrann"):
//     "Analysis by state shows a majority in all states believe the country
//      is going in the wrong direction. This is highest in Queensland, where
//      68.5% believe this, and once again lowest in South Australia (54%)."
//
// RELEASES ALTERNATE which block they print (10328/10333: gender+vote;
// 10343/10353: vote only; 10363/10366: state extremes only), so an absent
// block is a plain release choice, never an error. A block whose head
// anchor IS present but whose figures no longer read returns { error } —
// that's a format change, and the extractor guards rather than filing a
// wave short.
export const VOTE_GROUPS = ["One Nation", "L-NP", "Other", "Independent", "Greens", "ALP"];
export const STATES_FULL = ["New South Wales", "Victoria", "Queensland", "South Australia", "Western Australia", "Tasmania"];

const STATE_ALT = STATES_FULL.join("|");
const WRONG = "'going in the wrong direction'";
const RIGHT = "'going in the right direction'";

/* "Analysis by gender" → { Men: {r,w}, Women: {r,w} } | null | { error }.
   The anchor is not enough on its own: some 2026 releases print an
   "Analysis by gender" block about the two-party preferred vote (10113:
   "women supporting the ALP on 61% … two-party preferred basis …") with no
   direction content at all. A block whose own prose never mentions
   direction is that VI cut, not a direction block — absent, not an error.
   The genuine direction block names 'going in the … direction' within its
   first ~60 chars; 400 chars of scope is generous and bounded. */
export function parseGender(text) {
  const t = String(text ?? "");
  const i = t.search(/Analysis by gender/i);
  if (i === -1) return null;
  if (!/direction/i.test(t.slice(i, i + 400))) return null;
  const w = t.match(new RegExp("Analysis by gender shows ([\\d.]+)% of men and ([\\d.]+)% of women say (?:Australia|the country) is " + WRONG, "i"));
  const r = t.match(new RegExp("\\bonly ([\\d.]+)% of men and just ([\\d.]+)% of women say (?:Australia|the country) is " + RIGHT, "i"));
  if (!w || !r) return { error: "the 'Analysis by gender' block no longer reads" };
  return { Men: { w: +w[1], r: +r[1] }, Women: { w: +w[2], r: +r[2] } };
}

/* "Analysis by voting intention" → { "One Nation": {w}, "L-NP": {w},
   "Other": {w}, "Independent": {w}, "Greens": {w}, "ALP": {w, r} } | null |
   { error }. Every supporter group must read — a five-group list that drops
   one is a layout change, not a partial print. The ALP contrast sentence's
   right share is optional (r: null when unprinted), but never silently: a
   right-direction clause that dangles unparsed is an error. */
export function parseVote(text) {
  const t = String(text ?? "");
  const i = t.search(/Analysis by voting intention/i);
  if (i === -1) return null;
  const scope = t.slice(i, i + 1500);
  const grp = (re, name) => {
    const m = scope.match(re);
    return m ? +m[1] : { error: `the voting-intention block's ${name} figure no longer reads` };
  };
  const on = grp(/One Nation supporters \(([\d.]+)%\)/i, "One Nation");
  const ln = grp(/L-NP(?:\s+Coalition)? supporters \(([\d.]+)%\)/i, "L-NP");
  const ot = grp(/Other Party supporters \(([\d.]+)%\)/i, "Other Party");
  const ind = grp(/(?:Independent supporters|supporters of Independent candidates) \(([\d.]+)%\)/i, "Independent");
  const gr = grp(/Greens supporters \(([\d.]+)%\)/i, "Greens");
  const err = [on, ln, ot, ind, gr].find((g) => g.error);
  if (err) return { error: err.error };
  const alpW = scope.match(new RegExp("only ([\\d.]+)% of ALP supporters say (?:the country is|Australia is) " + WRONG, "i"));
  if (!alpW) return { error: "the voting-intention block's ALP contrast sentence no longer reads" };
  let alpR = null;
  const alpRm = scope.match(new RegExp("a(?:\\s+slim)? majority of ([\\d.]+)% say (?:the country is|Australia is) " + RIGHT, "i"));
  if (alpRm) alpR = +alpRm[1];
  else if (new RegExp("majority.*" + RIGHT, "i").test(scope))
    return { error: "the ALP contrast sentence's right-direction share no longer reads" };
  return { "One Nation": { w: on }, "L-NP": { w: ln }, Other: { w: ot }, Independent: { w: ind }, Greens: { w: gr }, ALP: { w: +alpW[1], r: alpR } };
}

/* "Analysis by state" → { highest: {state, w}, lowest: {state, w} } | null |
   { error }. States are the printed full names (never abbreviated here).
   Scoped to the block: the demographic-table notes elsewhere in a release
   carry "lowest in South Australia (14.5%)"-style figure lines whose (…%)
   is a primary vote, not a direction share. */
export function parseStateExtremes(text) {
  const t = String(text ?? "");
  const i = t.search(/Analysis by state/i);
  if (i === -1) return null;
  const scope = t.slice(i, i + 400);
  const hi = scope.match(new RegExp("highest in (" + STATE_ALT + "), where ([\\d.]+)% believe this", "i"));
  const lo = scope.match(new RegExp("(?:once again )?lowest in (" + STATE_ALT + ") \\(([\\d.]+)%\\)", "i"));
  if (!hi || !lo) return { error: "the 'Analysis by state' block's highest/lowest figures no longer read" };
  return { highest: { state: hi[1], w: +hi[2] }, lowest: { state: lo[1], w: +lo[2] } };
}

/* All three blocks for one release: { gender?, vote?, stateExtremes? } where
   present; errors collect per block. */
export function parseDirectionGroups(text) {
  const out = {}, problems = [];
  for (const [key, parse] of [["gender", parseGender], ["vote", parseVote], ["stateExtremes", parseStateExtremes]]) {
    const r = parse(text);
    if (r && r.error) problems.push(r.error);
    else if (r) out[key] = r;
  }
  return problems.length ? { problems } : { groups: out };
}
