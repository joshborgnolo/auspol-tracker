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
  /* Issues, leaders & policy — SEC Newgate */
  "fed-govt-priorities": "issues-leaders",
  "working-from-home": "issues-leaders",
  "protest-support": "issues-leaders",
  "disaster-response-confidence": "issues-leaders",
  "news-consumption": "issues-leaders",
  "information-trust": "issues-leaders",
  "misinformation-confidence": "issues-leaders",
  "ai-impact": "issues-leaders",

  /* One Nation & the party system — SEC Newgate */
  "one-nation-appeal": "one-nation",
  "one-nation-motivations": "one-nation",
  "one-nation-rise-impact": "one-nation",
  "one-nation-super-policy": "one-nation",

  /* Cost of living & the economy — SEC Newgate */
  "col-coping-actions": "cost-of-living",
  "interest-rate-expectations": "cost-of-living",
  "job-security": "cost-of-living",
  "large-company-behaviour": "cost-of-living",
  "personal-standard-of-living": "cost-of-living",
  "car-purchase-intentions": "cost-of-living",
  "standard-of-living-parents": "cost-of-living",
  "regulation-attitudes": "cost-of-living",

  /* The budget, tax & housing — SEC Newgate */
  "tax-reforms": "budget-tax",
  "housing-affordability-contributors": "budget-tax",
  "super-for-housing": "budget-tax",
  "housing-values-fall": "budget-tax",
  "housing-market-timing": "budget-tax",
  "housing-value-expectations": "budget-tax",
  "budget-2026-measures": "budget-tax",
  "budget-2026-impact": "budget-tax",
  "cgt-changes-support": "budget-tax",
  "cgt-changes-impact": "budget-tax",
  "government-financial-assistance": "budget-tax",

  /* Immigration & multiculturalism — SEC Newgate */
  "immigration-level": "immigration",

  /* The national mood — SEC Newgate */
  "social-cohesion-outlook": "national-mood",
  "social-cohesion-improvement": "national-mood",
  "social-cohesion-roles": "national-mood",
  "budget-2026-trust": "national-mood",
  "direction-reasons": "national-mood",

  /* Security, energy & the wider world — SEC Newgate */
  "trump-presidency-effects": "security-world",
  "iran-military-action-support": "security-world",
  "renewables-bills-impact": "security-world",
  "renewables-reliability-impact": "security-world",
  "renewable-approvals-reform": "security-world",
  "country-relations": "security-world",
  "aukus-security": "security-world",
  "trump-description": "security-world",
  "fuel-security-module": "security-world",
  "fuel-rationing-support": "security-world",
  "fuel-impact-expectations": "security-world",
  "national-security-priorities": "security-world",
  "economy-important-country": "security-world",
  "china-economic-relationship": "security-world",

  /* One Nation & the party system — Essential */
  "angus-taylor-impact": "one-nation",
  "barnaby-next-move": "one-nation",
  "gender-quotas-coalition": "one-nation",
  "hanson-approval": "one-nation",
  "labor-mandate": "one-nation",
  "labor-second-term-expectations": "one-nation",
  "liberal-direction": "one-nation",
  "one-nation-concern": "one-nation",
  "one-nation-consideration-reason": "one-nation",
  "one-nation-vote-impacts": "one-nation",
  "openness-one-nation": "one-nation",
  "preferred-coalition-leader": "one-nation",

  /* Cost of living & the economy — Essential */
  "better-or-worse-off": "cost-of-living",
  "economic-roundtable": "cost-of-living",
  "economy-2026-expectations": "cost-of-living",
  "economy-outlook-6m": "cost-of-living",
  "groups-views-economy": "cost-of-living",
  "interest-rate-contributors": "cost-of-living",
  "productivity-definition": "cost-of-living",
  "support-economic-measures": "cost-of-living",
  "supply-chains": "cost-of-living",

  /* The budget, tax & housing — Essential */
  "attention-to-budget": "budget-tax",
  "budget-approval-2026": "budget-tax",
  "budget-changes-support": "budget-tax",
  "budget-cost-of-living-impact": "budget-tax",
  "budget-expectations": "budget-tax",
  "budget-in-reply-2026": "budget-tax",
  "budget-measures-2026": "budget-tax",
  "government-funding-increases": "budget-tax",
  "housing-concerns-ranking": "budget-tax",
  "initiatives-menu": "budget-tax",
  "negative-gearing-cgt-youth": "budget-tax",
  "superannuation-views": "budget-tax",
  "tax-system-views": "budget-tax",
  "taxing-wages-vs-investments": "budget-tax",

  /* Immigration & multiculturalism — Essential */
  "attitudes-immigration": "immigration",
  "immigration-cap": "immigration",
  "immigration-control-steps": "immigration",
  "immigration-if-services": "immigration",
  "immigration-impact": "immigration",
  "immigration-intake": "immigration",
  "immigration-reduction-source": "immigration",
  "immigration-views": "immigration",
  "racism": "immigration",

  /* The national mood — Essential */
  "addressing-issues-attitude": "national-mood",
  "australia-day-views": "national-mood",
  "australia-division-trajectory": "national-mood",
  "australia-vs-countries": "national-mood",
  "australians-qualities": "national-mood",
  "celebrity-political-opinions": "national-mood",
  "expectations-2026": "national-mood",
  "future-outlook": "national-mood",
  "good-bad-year": "national-mood",
  "group-membership": "national-mood",
  "group-participation": "national-mood",
  "happiness-personal": "national-mood",
  "indigenous-national-day": "national-mood",
  "kind-nation": "national-mood",
  "kindness-self-vs-australians": "national-mood",
  "manosphere-attitudes": "national-mood",
  "manosphere-awareness": "national-mood",
  "melbourne-cup-attitudes": "national-mood",
  "melbourne-cup-betting": "national-mood",
  "melbourne-cup-interest": "national-mood",
  "personal-qualities": "national-mood",
  "qualities-australians": "national-mood",
  "qualities-self": "national-mood",
  "reflections-2025": "national-mood",
  "santa-tradition": "national-mood",
  "social-cohesion": "national-mood",
  "trust-institutions": "national-mood",
  "violence-against-women": "national-mood",
  "world-division-trajectory": "national-mood",

  /* Security, energy & the wider world — Essential */
  "albanese-trump-confidence": "security-world",
  "albanese-trump-meeting": "security-world",
  "albanese-trump-meeting-importance": "security-world",
  "antisemitism-policies": "security-world",
  "aukus-delivery": "security-world",
  "better-party-international": "security-world",
  "bondi-albanese-handling": "security-world",
  "bondi-antisemitism-views": "security-world",
  "bondi-initiatives": "security-world",
  "bondi-jewish-checkins": "security-world",
  "bondi-policies": "security-world",
  "climate-acceptance": "security-world",
  "climate-action": "security-world",
  "cop-awareness": "security-world",
  "cop30-outcomes": "security-world",
  "cop31-hosting": "security-world",
  "country-to-strengthen": "security-world",
  "emissions-target-2035": "security-world",
  "emissions-target-2035-likelihood": "security-world",
  "emissions-targets-views": "security-world",
  "energy-supply-attitudes": "security-world",
  "existential-threats": "security-world",
  "fuel-crisis-personal": "security-world",
  "fuel-crisis-responsibility": "security-world",
  "gaza-war-response": "security-world",
  "hate-speech-laws": "security-world",
  "international-relationships": "security-world",
  "iran-australia-response": "security-world",
  "iran-strikes-approval": "security-world",
  "iran-war-engagement": "security-world",
  "israel-gaza-action": "security-world",
  "meeting-outcomes-support": "security-world",
  "middle-east-involvement": "security-world",
  "net-zero-2050": "security-world",
  "palestine-recognition": "security-world",
  "palestine-recognition-consequences": "security-world",
  "preventing-global-warming": "security-world",
  "relationship-china": "security-world",
  "relationship-uk": "security-world",
  "relationship-us": "security-world",
  "relationships-with-countries": "security-world",
  "trump-favourability": "security-world",
  "trump-presidency-impact": "security-world",
  "us-alignment": "security-world",
  "us-tariff-pressures": "security-world",
  "us-tariffs-response": "security-world",
  "us-vs-middle-powers": "security-world",
  "views-on-countries": "security-world",

  /* One Nation & the party system — Resolve */
  "joyce-one-nation-effect": "one-nation",
  "taylor-awareness": "one-nation",
  "hanson-young-workers-lazy": "one-nation",
  "hanson-ndis-priorities": "one-nation",
  "hanson-poverty-serious": "one-nation",
  "easier-to-sack-workers": "one-nation",

  /* Cost of living & the economy — Resolve */
  "cost-of-living-blame": "cost-of-living",
  "unexpected-expense-struggle": "cost-of-living",
  "christmas-spending-cutback": "cost-of-living",
  "fuel-price-driving-changes": "cost-of-living",

  /* The budget, tax & housing — Resolve */
  "labor-broken-promises-view": "budget-tax",
  "cgt-discount-removal": "budget-tax",
  "negative-gearing-restriction": "budget-tax",
  "ndis-cuts-support": "budget-tax",
  "trust-tax-increase": "budget-tax",
  "budget-good-for-household": "budget-tax",
  "lower-house-prices": "budget-tax",
  "federal-debt-concern": "budget-tax",
  "state-debt-concern": "budget-tax",
  "debt-deficit-remedy": "budget-tax",
  "albanese-trust-broken-promises": "budget-tax",
  "budget-broken-promises-labor-vote": "budget-tax",

  /* Immigration & multiculturalism — Resolve */
  "immigration-reduction-support": "immigration",
  "immigration-pause-housing": "immigration",
  "migration-skills-restriction": "immigration",
  "immigration-screening-extremism": "immigration",
  "hanson-immigration-settings": "immigration",
  "australia-monoculture": "immigration",
  "immigration-program-handling": "immigration",
  "racism-rise-since-gaza": "immigration",
  "racism-driver": "immigration",

  /* The national mood — Resolve */
  "social-cohesion-rating": "national-mood",

  /* Security, energy & the wider world — Resolve */
  "bondi-response-strength": "security-world",
  "bondi-response-leaders": "security-world",
  "antisemitism-royal-commission": "security-world",

  /* Issues, leaders & policy — Resolve */
  "greens-leader-awareness": "issues-leaders",
  "greens-leadership-vote-impact": "issues-leaders",
  "greens-leaders-familiarity": "issues-leaders",

  /* Issues, leaders & policy — Essential */
  "abortion-access-20-weeks": "issues-leaders",
  "abortion-care": "issues-leaders",
  "abortion-views": "issues-leaders",
  "ai-copyright": "issues-leaders",
  "ai-development": "issues-leaders",
  "ai-impacts-concern": "issues-leaders",
  "ai-opportunities-risks": "issues-leaders",
  "ai-workplace-regulation": "issues-leaders",
  "ai-workplace-views": "issues-leaders",
  "allan-approval": "issues-leaders",
  "battin-approval": "issues-leaders",
  "data-centre-concerns": "issues-leaders",
  "data-centre-local": "issues-leaders",
  "election-commitments": "issues-leaders",
  "election-important-issue": "issues-leaders",
  "election-vote-decision": "issues-leaders",
  "four-day-week": "issues-leaders",
  "gambling-ad-rules": "issues-leaders",
  "gambling-advertising": "issues-leaders",
  "generative-ai-use": "issues-leaders",
  "gov-action-economy": "issues-leaders",
  "gov-action-environment": "issues-leaders",
  "government-issue-performance": "issues-leaders",
  "government-performance": "issues-leaders",
  "health-ratings": "issues-leaders",
  "health-services-performance": "issues-leaders",
  "healthcare-cost-impact": "issues-leaders",
  "issue-importance": "issues-leaders",
  "new-government-issues": "issues-leaders",
  "party-trust-economy": "issues-leaders",
  "policy-support-battery": "issues-leaders",
  "public-health-confidence": "issues-leaders",
  "regulation-australia": "issues-leaders",
  "regulation-by-area": "issues-leaders",
  "social-media-ban": "issues-leaders",
  "social-media-ban-effectiveness": "issues-leaders",
  "social-media-feed-control": "issues-leaders",
  "social-media-regulation": "issues-leaders",
  "stronger-unions-impact": "issues-leaders",
  "unions-importance": "issues-leaders",
  "worker-protections-confidence": "issues-leaders",
  "working-life-concerns": "issues-leaders",
};

const THEME_IDS = new Set(THEMES.map((t) => t.id));

export function themeOf(entryId) {
  const t = THEME_OF[entryId];
  if (!t) throw new Error(`adhoc-themes: no theme for entry id "${entryId}"`);
  if (!THEME_IDS.has(t)) throw new Error(`adhoc-themes: entry "${entryId}" maps to unknown theme "${t}"`);
  return t;
}
