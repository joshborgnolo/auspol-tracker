/* ---- ad-hocs theme taxonomy ------------------------------------------------
   The single source for how the /ad-hocs/ page groups its entries. TWO reads
   of this file must never diverge: gen-data.mjs themes every entry as it
   packs oneoffs-source.json, and build.mjs's ssAdhocsBlock regroups from the
   same map for the tab document's static article. themeOf throws on an
   unmapped id, so a new wave of the stores (or a new house) fails the build
   loudly rather than landing silently ungrouped. */

export const THEMES = [
  { id: "one-nation", title: "One Nation & the party system",
    dek: "The surge itself: who is moving to One Nation, what pulls them, what holds them back, and how the majors are being reshaped around it." },
  { id: "cost-of-living", title: "Cost of living & the economy",
    dek: "Household finances, interest rates, energy prices and the people respondents say are responsible for them." },
  { id: "budget-tax", title: "The budget, tax & housing",
    dek: "The May budget and its housing-tax package: awareness, verdicts, and what voters would rather the money went to." },
  { id: "immigration", title: "Immigration & multiculturalism",
    dek: "The issue the cycle most visibly turned on, asked outright: levels, source countries, and whether diversity still serves the country." },
  { id: "national-mood", title: "The national mood",
    dek: "Right direction or wrong track, the system's legitimacy, pride in the country, and what the country was actually talking about each month." },
  { id: "security-world", title: "Security, energy & the wider world",
    dek: "Bondi, the Iran war, fuel security and where voters locate the safe ground between defence and net zero." },
  { id: "issues-leaders", title: "Issues, leaders & policy",
    dek: "Which issues matter, which party is trusted on them, and the policy one-offs that fit nowhere else." },
];

export const THEME_OF = {
  /* One Nation & the party system — News24 */
  "ever-support-one-nation": "one-nation",
  "reason-considering-one-nation": "one-nation",
  "serious-consideration": "one-nation",
  "coalition-one-nation-cooperation": "one-nation",
  "one-nation-readiness-to-govern": "one-nation",
  "vote-regret-2025": "one-nation",
  "best-liberal-leader": "one-nation",
  "liberal-vote-shift-since-2025": "one-nation",
  "coalition-vote-flows": "one-nation",
  /* One Nation & the party system — RedBridge */
  "reasons-for-voting-one-nation": "one-nation",
  "one-nation-message-experiment": "one-nation",
  "one-nation-most-hesitant": "one-nation",
  "vote-change-reasons": "one-nation",
  "party-messaging-battery": "one-nation",

  /* Cost of living & the economy — News24 */
  "financial-situation-3m": "cost-of-living",
  "chalmers-cost-of-living-verdict": "cost-of-living",
  "unemployment-next-12-months": "cost-of-living",
  "energy-prices-next-12-months": "cost-of-living",
  "fuel-consumption-action": "cost-of-living",
  "healthcare-affordability-working-class": "cost-of-living",
  "rate-hike-government-responsibility": "cost-of-living",
  "rate-hike-blame": "cost-of-living",
  "chalmers-middle-east-rate-rise": "cost-of-living",
  /* Cost of living & the economy — RedBridge */
  "life-decision-delays": "cost-of-living",
  "wealthy-income-threshold": "cost-of-living",

  /* The budget, tax & housing — News24 */
  "budget-priorities": "budget-tax",
  "budget-better-or-worse-off": "budget-tax",
  "cgt-negative-gearing-housing-verdict": "budget-tax",
  /* The budget, tax & housing — RedBridge */
  "deficit-seriousness": "budget-tax",
  "deficit-response-preferences": "budget-tax",
  "budget-awareness-and-perceptions": "budget-tax",
  "budget-rent-effect": "budget-tax",

  /* Immigration & multiculturalism — News24 */
  "immigration-levels": "immigration",
  "immigration-terror-controlled-regions": "immigration",
  "multiculturalism": "immigration",
  "best-party-immigration-policies": "immigration",

  /* The national mood — News24 */
  "australia-stronger-or-weaker": "national-mood",
  /* The national mood — RedBridge */
  "australia-right-direction": "national-mood",
  "feelings-way-things-going": "national-mood",
  "next-generation-outlook": "national-mood",
  "pride-and-superannuation": "national-mood",
  "state-of-politics-system": "national-mood",
  "news-story-week": "national-mood",

  /* Security, energy & the wider world — News24 */
  "bondi-attack-response-rating": "security-world",
  "national-security-feeling": "security-world",
  "iran-war-biggest-concern": "security-world",
  "trump-iran-war-handling": "security-world",
  "fuel-reserve-20bn": "security-world",
  "oil-gas-exploration-vs-net-zero": "security-world",

  /* Issues, leaders & policy — News24 */
  "most-important-issue": "issues-leaders",
  "best-party-placement-4-issues": "issues-leaders",
  "best-party-placement-12-issues": "issues-leaders",
  "best-party-economy-security": "issues-leaders",
  "best-party-climate-and-energy": "issues-leaders",
  "social-media-ban-under16": "issues-leaders",
};

const THEME_IDS = new Set(THEMES.map((t) => t.id));

export function themeOf(entryId) {
  const t = THEME_OF[entryId];
  if (!t) throw new Error(`adhoc-themes: no theme for entry id "${entryId}"`);
  if (!THEME_IDS.has(t)) throw new Error(`adhoc-themes: entry "${entryId}" maps to unknown theme "${t}"`);
  return t;
}
