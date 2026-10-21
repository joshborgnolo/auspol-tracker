/* ---- Public opinion: the topic map -----------------------------------------
   Where every question in the eight one-off stores lands on the /public-opinion/
   page (the ☰ menu page that was /ad-hocs/ until 2026-10-18, then
   /beyond-the-vote/ until 2026-10-21). TWO reads of
   this file must never diverge: gen-data.mjs files every entry under its topic
   as it builds the page's sidecar (via beyond-the-vote.mjs), and build.mjs's
   static article regroups from the same payload. themeOf THROWS on an unmapped
   id, so a new wave of the stores (or a new house) fails the build loudly
   rather than landing silently unsorted: map a new id to a topic (it joins that
   topic's "More questions" list until beyond-the-vote.mjs features it) or to
   "cut".

   "cut" is the editorial call that a question is not worth a reader's time on
   this site (2026-10-18): lifestyle and trivia (the Melbourne Cup, Santa, sport
   participation, "Australians are kind"), state-politics questions on a federal
   page, the pre-term 2024 Gaza special, questions whose figures exist only as
   images in the source (RedBridge's coded free-text charts), and empty
   extractions. Repeats of what the main page already tracks (right direction,
   the best-party-on-issues batteries, consideration reads, recalled-vote
   flows) are removed from the stores outright instead (2026-10-18, user
   call), not theme-cut. The stores keep the cut ones; the page does not show
   them. */

/* The topics, in page order: the term's biggest stories first. `short` is the
   jump-nav label, `about` the topic as a phrase inside a sentence ("More
   questions on ..."); `dek` says what the topic covers and never claims a
   finding (the findings live on the charts and cards, under margin rules). */
export const THEMES = [
  { id: "immigration", title: "Immigration", short: "Immigration", about: "immigration",
    dek: "How many migrants Australians want, where cuts should fall, and how they rate the government’s handling of the program." },
  { id: "trump-us", title: "Trump and the United States", short: "Trump and the US", about: "Trump and the United States",
    dek: "How Australians see Donald Trump, the American alliance and AUKUS." },
  { id: "one-nation", title: "One Nation and the Coalition", short: "One Nation", about: "One Nation and the Coalition",
    dek: "What draws voters to One Nation, what holds them back, and how Pauline Hanson’s agenda sits with everyone else." },
  { id: "housing-budget", title: "Housing, tax and the budget", short: "Housing and the budget", about: "housing, tax and the budget",
    dek: "Verdicts on the May 2026 budget, its capital gains tax and negative gearing changes, and the broken promises behind them." },
  { id: "cost-of-living", title: "Cost of living and the economy", short: "Cost of living", about: "the cost of living and the economy",
    dek: "Household finances, interest rates, and who voters blame for rising prices." },
  { id: "war-security", title: "War, fuel and security", short: "War and fuel", about: "war, fuel and security",
    dek: "The Iran war and the fuel crisis that followed, Gaza and the recognition of Palestine, and ties with China." },
  { id: "bondi-cohesion", title: "Bondi and social cohesion", short: "Bondi and cohesion", about: "Bondi and social cohesion",
    dek: "Responses to the December 2025 Bondi terror attack, antisemitism and racism, and whether the country is pulling apart." },
  { id: "climate-energy", title: "Climate and energy", short: "Climate and energy", about: "climate and energy",
    dek: "Net zero, emissions targets, gas and the energy transition." },
  { id: "tech-society", title: "Technology and society", short: "Tech and society", about: "technology and society",
    dek: "The under-16 social media ban, AI and data centres, gambling ads, unions, abortion and other questions of how we live and work." },
  { id: "trust-democracy", title: "Leaders, trust and democracy", short: "Trust and democracy", about: "leaders, trust and democracy",
    dek: "How voters rate the government, the leaders and the institutions, and how much they think politics needs to change." },
];

export const THEME_OF = {

  /* trump-us */
  // demosau
  "trump-democracy-statements-2026-07": "trump-us",
  "pm-like-trump": "trump-us",
  "government-relationship-with-trump": "trump-us",
  "us-reliable-military-ally": "trump-us",
  // essential
  "trump-presidency-impact": "trump-us",
  "us-alignment": "trump-us",
  "us-vs-middle-powers": "trump-us",
  "aukus-delivery": "trump-us",
  "views-on-countries": "trump-us",
  "relationships-with-countries": "trump-us",
  "international-relationships": "trump-us",
  "country-to-strengthen": "trump-us",
  "albanese-trump-confidence": "trump-us",
  "albanese-trump-meeting-importance": "trump-us",
  "albanese-trump-meeting": "trump-us",
  "meeting-outcomes-support": "trump-us",
  "us-tariff-pressures": "trump-us",
  // essential+freshwater+redbridge
  "trump-favourability": "trump-us",
  // essential+secnewgate
  "aukus-security": "trump-us",
  // secnewgate
  "trump-sentiment": "trump-us",
  "trump-description": "trump-us",
  "trump-presidency-effects": "trump-us",
  "national-security-priorities": "trump-us",
  "country-relations": "trump-us",

  /* immigration */
  // essential
  "immigration-intake": "immigration",
  "immigration-cap": "immigration",
  "attitudes-immigration": "immigration",
  "immigration-if-services": "immigration",
  "immigration-control-steps": "immigration",
  "immigration-reduction-source": "immigration",
  "immigration-views": "immigration",
  // essential+newspoll
  "immigration-impact": "immigration",
  // news24
  "multiculturalism": "immigration",
  "immigration-terror-controlled-regions": "immigration",
  // news24+newspoll
  "immigration-levels": "immigration",
  "backpacker-visa-cuts": "immigration",
  // resolve
  "immigration-program-handling": "immigration",
  "australia-monoculture": "immigration",
  "immigration-reduction-support": "immigration",
  "immigration-pause-housing": "immigration",
  "migration-skills-restriction": "immigration",
  "hanson-immigration-settings": "immigration",
  // resolve+secnewgate
  "immigration-level": "immigration",

  /* one-nation */
  // demosau
  "hanson-statements": "one-nation",
  "hanson-retirement-hypothetical-vi": "one-nation",
  "abbott-led-coalition-hypothetical-vi": "one-nation",
  // essential
  "one-nation-consideration-reason": "one-nation",
  "hanson-approval": "one-nation",
  "one-nation-concern": "one-nation",
  "one-nation-vote-impacts": "one-nation",
  "barnaby-next-move": "one-nation",
  "angus-taylor-impact": "one-nation",
  // essential+news24
  "best-liberal-leader": "one-nation",
  // essential+newspoll+resolve
  "preferred-coalition-leader": "one-nation",
  // essential+resolve
  "liberal-direction": "one-nation",
  "gender-quotas-coalition": "one-nation",
  // news24
  "coalition-one-nation-cooperation": "one-nation",
  "one-nation-readiness-to-govern": "one-nation",
  "reason-considering-one-nation": "one-nation",
  "vote-regret-2025": "one-nation",
  "liberal-vote-shift-since-2025": "one-nation",
  // newspoll
  "vote-driver-most-important": "one-nation",
  "vote-recall-2025-flows": "one-nation",
  // redbridge
  "one-nation-most-hesitant": "one-nation",
  "one-nation-message-experiment": "one-nation",
  "party-messaging-battery": "one-nation",
  // resolve
  "hanson-young-workers-lazy": "one-nation",
  "hanson-ndis-priorities": "one-nation",
  "hanson-poverty-serious": "one-nation",
  "easier-to-sack-workers": "one-nation",
  "joyce-one-nation-effect": "one-nation",
  "taylor-awareness": "one-nation",
  // secnewgate
  "one-nation-appeal": "one-nation",
  "one-nation-rise-impact": "one-nation",
  "one-nation-super-policy": "one-nation",
  "one-nation-super-early-access": "one-nation",
  "one-nation-motivations": "one-nation",

  /* housing-budget */
  // demosau
  "budget-2026-tax-measures": "housing-budget",
  "tax-measures-tracker-2026-06": "housing-budget",
  "budget-2026-overall-opinion": "housing-budget",
  "housing-shortage-blame": "housing-budget",
  "budget-2026-tax-statements": "housing-budget",
  "investment-income-tax-preference": "housing-budget",
  "super-access-statements": "housing-budget",
  "super-3m-tax-support": "housing-budget",
  "cigarette-tax-black-market": "housing-budget",
  // essential
  "budget-measures-2026": "housing-budget",
  "budget-approval-2026": "housing-budget",
  "election-commitments": "housing-budget",
  "negative-gearing-cgt-youth": "housing-budget",
  "taxing-wages-vs-investments": "housing-budget",
  "budget-changes-support": "housing-budget",
  "budget-expectations": "housing-budget",
  "budget-cost-of-living-impact": "housing-budget",
  "budget-in-reply-2026": "housing-budget",
  "attention-to-budget": "housing-budget",
  "housing-concerns-ranking": "housing-budget",
  "superannuation-views": "housing-budget",
  "government-funding-increases": "housing-budget",
  "initiatives-menu": "housing-budget",
  // essential+news24
  "budget-priorities": "housing-budget",
  // news24
  "budget-better-or-worse-off": "housing-budget",
  "cgt-negative-gearing-housing-verdict": "housing-budget",
  // newspoll
  "post-budget-economy-verdict": "housing-budget",
  "post-budget-personal-impact": "housing-budget",
  "house-prices-direction": "housing-budget",
  "post-budget-coalition-budget": "housing-budget",
  "post-budget-inflation-verdict": "housing-budget",
  "post-budget-housing-verdict": "housing-budget",
  "budget-revenue-options": "housing-budget",
  // redbridge
  "budget-rent-effect": "housing-budget",
  "budget-awareness-and-perceptions": "housing-budget",
  "deficit-seriousness": "housing-budget",
  "deficit-response-preferences": "housing-budget",
  // resolve
  "cgt-discount-removal": "housing-budget",
  "negative-gearing-restriction": "housing-budget",
  "budget-good-for-household": "housing-budget",
  "budget-broken-promises-labor-vote": "housing-budget",
  "lower-house-prices": "housing-budget",
  "labor-broken-promises-view": "housing-budget",
  "albanese-trust-broken-promises": "housing-budget",
  "trust-tax-increase": "housing-budget",
  "ndis-cuts-support": "housing-budget",
  "federal-debt-concern": "housing-budget",
  "state-debt-concern": "housing-budget",
  "debt-deficit-remedy": "housing-budget",
  // secnewgate
  "budget-2026-measures": "housing-budget",
  "cgt-changes-support": "housing-budget",
  "budget-2026-impact": "housing-budget",
  "super-for-housing": "housing-budget",
  "budget-2026-trust": "housing-budget",
  "cgt-changes-impact": "housing-budget",
  "housing-affordability-contributors": "housing-budget",
  "housing-values-fall": "housing-budget",
  "housing-value-expectations": "housing-budget",
  "housing-market-timing": "housing-budget",
  "tax-reforms": "housing-budget",
  "government-financial-assistance": "housing-budget",

  /* cost-of-living */
  // essential
  "interest-rate-contributors": "cost-of-living",
  "healthcare-cost-impact": "cost-of-living",
  "working-life-concerns": "cost-of-living",
  "better-or-worse-off": "cost-of-living",
  "economy-2026-expectations": "cost-of-living",
  "regulation-australia": "cost-of-living",
  "economic-roundtable": "cost-of-living",
  "support-economic-measures": "cost-of-living",
  "groups-views-economy": "cost-of-living",
  "gov-action-economy": "cost-of-living",
  // essential+resolve
  "economy-outlook-6m": "cost-of-living",
  // news24
  "chalmers-middle-east-rate-rise": "cost-of-living",
  "rate-hike-blame": "cost-of-living",
  "rate-hike-government-responsibility": "cost-of-living",
  "chalmers-cost-of-living-verdict": "cost-of-living",
  "financial-situation-3m": "cost-of-living",
  "healthcare-affordability-working-class": "cost-of-living",
  "household-financial-situation": "cost-of-living",
  "medical-treatment-access": "cost-of-living",
  "energy-prices-next-12-months": "cost-of-living",
  "unemployment-next-12-months": "cost-of-living",
  "unemployment-expectations": "cost-of-living",
  "card-surcharge-ban": "cost-of-living",
  "card-surcharge-ban-price-tradeoff": "cost-of-living",
  // newspoll
  "inflation-response-priorities": "cost-of-living",
  // redbridge
  "life-decision-delays": "cost-of-living",
  "next-generation-outlook": "cost-of-living",
  "wealthy-income-threshold": "cost-of-living",
  // resolve
  "cost-of-living-blame": "cost-of-living",
  "unexpected-expense-struggle": "cost-of-living",
  "christmas-spending-cutback": "cost-of-living",
  // secnewgate
  "standard-of-living-parents": "cost-of-living",
  "interest-rate-expectations": "cost-of-living",
  "personal-standard-of-living": "cost-of-living",
  "col-coping-actions": "cost-of-living",
  "job-security": "cost-of-living",
  "large-company-behaviour": "cost-of-living",
  "regulation-attitudes": "cost-of-living",

  /* war-security */
  // demosau+essential
  "palestine-recognition": "war-security",
  // essential
  "iran-strikes-approval": "war-security",
  "middle-east-involvement": "war-security",
  "iran-australia-response": "war-security",
  "fuel-crisis-responsibility": "war-security",
  "fuel-crisis-personal": "war-security",
  "palestine-recognition-consequences": "war-security",
  "gaza-war-response": "war-security",
  "israel-gaza-action": "war-security",
  // news24
  "iran-war-biggest-concern": "war-security",
  "trump-iran-war-handling": "war-security",
  "fuel-reserve-20bn": "war-security",
  "fuel-consumption-action": "war-security",
  "national-security-feeling": "war-security",
  // newspoll
  "iran-us-military-action": "war-security",
  "hormuz-naval-deployment": "war-security",
  // resolve
  "fuel-price-driving-changes": "war-security",
  // secnewgate
  "fuel-rationing-support": "war-security",
  "fuel-impact-expectations": "war-security",
  "fuel-security-module": "war-security",
  "iran-military-action-support": "war-security",
  "china-economic-relationship": "war-security",
  "economy-important-country": "war-security",

  /* bondi-cohesion */
  // essential
  "bondi-albanese-handling": "bondi-cohesion",
  "bondi-initiatives": "bondi-cohesion",
  "hate-speech-laws": "bondi-cohesion",
  "bondi-antisemitism-views": "bondi-cohesion",
  "antisemitism-seriousness": "bondi-cohesion",
  "radical-islamic-extremism": "bondi-cohesion",
  "antisemitism-policies": "bondi-cohesion",
  "racism": "bondi-cohesion",
  "social-cohesion": "bondi-cohesion",
  "australia-division-trajectory": "bondi-cohesion",
  "world-division-trajectory": "bondi-cohesion",
  "australia-day-views": "bondi-cohesion",
  "indigenous-national-day": "bondi-cohesion",
  // news24
  "bondi-attack-response-rating": "bondi-cohesion",
  // resolve
  "bondi-response-strength": "bondi-cohesion",
  "bondi-response-leaders": "bondi-cohesion",
  "antisemitism-royal-commission": "bondi-cohesion",
  "immigration-screening-extremism": "bondi-cohesion",
  "racism-rise-since-gaza": "bondi-cohesion",
  "racism-driver": "bondi-cohesion",
  "social-cohesion-rating": "bondi-cohesion",
  // secnewgate
  "social-cohesion-outlook": "bondi-cohesion",
  "social-cohesion-improvement": "bondi-cohesion",
  "social-cohesion-roles": "bondi-cohesion",
  "protest-support": "bondi-cohesion",

  /* climate-energy */
  // essential
  "net-zero-2050": "climate-energy",
  "emissions-target-2035": "climate-energy",
  "energy-supply-attitudes": "climate-energy",
  "climate-acceptance": "climate-energy",
  "climate-action": "climate-energy",
  "emissions-target-2035-likelihood": "climate-energy",
  "emissions-targets-views": "climate-energy",
  "preventing-global-warming": "climate-energy",
  "cop31-hosting": "climate-energy",
  "gov-action-environment": "climate-energy",
  // news24
  "oil-gas-exploration-vs-net-zero": "climate-energy",
  // secnewgate
  "renewables-bills-impact": "climate-energy",
  "renewables-reliability-impact": "climate-energy",
  "renewable-approvals-reform": "climate-energy",

  /* tech-society */
  // demosau
  "youtube-ban-u16s": "tech-society",
  "youtube-ban-circumvent": "tech-society",
  "social-media-duty-of-care": "tech-society",
  "digital-duty-of-care-bill": "tech-society",
  "algorithm-opt-out": "tech-society",
  "ai-concerns": "tech-society",
  "ai-concern-types": "tech-society",
  "ai-employment-impact": "tech-society",
  "ai-usage-frequency": "tech-society",
  "ai-usage-purposes": "tech-society",
  "data-centres-good-bad": "tech-society",
  "data-centre-local-effects": "tech-society",
  "in-your-area-new-builds": "tech-society",
  "male-childcare-worker-ban": "tech-society",
  "childcare-sector-statements": "tech-society",
  // essential
  "social-media-ban": "tech-society",
  "social-media-ban-effectiveness": "tech-society",
  "social-media-regulation": "tech-society",
  "social-media-feed-control": "tech-society",
  "ai-opportunities-risks": "tech-society",
  "generative-ai-use": "tech-society",
  "ai-workplace-views": "tech-society",
  "ai-workplace-regulation": "tech-society",
  "ai-development": "tech-society",
  "ai-copyright": "tech-society",
  "ai-impacts-concern": "tech-society",
  "existential-threats": "tech-society",
  "regulation-by-area": "tech-society",
  "data-centre-local": "tech-society",
  "data-centre-concerns": "tech-society",
  "gambling-ad-rules": "tech-society",
  "gambling-advertising": "tech-society",
  "abortion-views": "tech-society",
  "abortion-access-20-weeks": "tech-society",
  "abortion-care": "tech-society",
  "stronger-unions-impact": "tech-society",
  "unions-importance": "tech-society",
  "worker-protections-confidence": "tech-society",
  "four-day-week": "tech-society",
  "violence-against-women": "tech-society",
  "manosphere-awareness": "tech-society",
  "manosphere-attitudes": "tech-society",
  // news24
  "social-media-ban-under16": "tech-society",
  // secnewgate
  "misinformation-confidence": "tech-society",
  "ai-impact": "tech-society",
  "working-from-home": "tech-society",

  /* trust-democracy */
  // demosau
  "trustwatch-institutions": "trust-democracy",
  "politician-ratings-2026-07": "trust-democracy",
  "leader-attributes": "trust-democracy",
  "leader-most-attributes": "trust-democracy",
  "former-pm-ratings": "trust-democracy",
  "better-pm-for-cohorts": "trust-democracy",
  "billionaire-ratings": "trust-democracy",
  "trustwatch-media-trust": "trust-democracy",
  "trustwatch-democracy-statements": "trust-democracy",
  "democracy-wellbeing-statements": "trust-democracy",
  "aec-statements": "trust-democracy",
  "vote-counted-fairly": "trust-democracy",
  "how-to-vote-cards": "trust-democracy",
  "more-mps": "trust-democracy",
  "voting-systems": "trust-democracy",
  // essential
  "government-performance": "trust-democracy",
  "trust-institutions": "trust-democracy",
  "australia-vs-countries": "trust-democracy",
  "future-outlook": "trust-democracy",
  "expectations-2026": "trust-democracy",
  "happiness-personal": "trust-democracy",
  "issue-importance": "trust-democracy",
  "new-government-issues": "trust-democracy",
  "party-trust-economy": "trust-democracy",
  "government-issue-performance": "trust-democracy",
  "health-services-performance": "trust-democracy",
  "public-health-confidence": "trust-democracy",
  "policy-support-battery": "trust-democracy",
  "bondi-policies": "trust-democracy",
  "labor-mandate": "trust-democracy",
  "labor-second-term-expectations": "trust-democracy",
  // news24
  "australia-stronger-or-weaker": "trust-democracy",
  // news24+resolve
  "most-important-issue": "trust-democracy",
  // newspoll
  "politics-overdue-shakeup": "trust-democracy",
  "leader-traits-matchup": "trust-democracy",
  "leader-traits-history": "trust-democracy",
  // redbridge
  "state-of-politics-system": "trust-democracy",
  "pride-and-superannuation": "trust-democracy",
  // resolve
  "greens-leadership-vote-impact": "trust-democracy",
  "greens-leader-awareness": "trust-democracy",
  "greens-leaders-familiarity": "trust-democracy",
  // secnewgate
  "information-trust": "trust-democracy",
  "fed-govt-priorities": "trust-democracy",
  "disaster-response-confidence": "trust-democracy",

  /* cut */
  // demosau
  "admired-sportspersons": "cut",
  "sport-participation-adults": "cut",
  "sport-participation-desire": "cut",
  "sport-participation-barriers": "cut",
  "child-sport-participation": "cut",
  "child-sport-desire": "cut",
  "child-sport-barriers": "cut",
  "australian-values": "cut",
  "life-satisfaction": "cut",
  "economic-wellbeing-statements": "cut",
  "health-wellbeing-statements": "cut",
  "social-wellbeing-statements": "cut",
  "environment-wellbeing-statements": "cut",
  "ai-training-plans": "cut",
  "gaza-war-priority-2024": "cut",
  "gaza-recognise-palestinian-state-2024": "cut",
  "gaza-war-terrorism-vital-2024": "cut",
  "gaza-war-australia-israel-allies-2024": "cut",
  "gaza-war-stop-immediately-2024": "cut",
  "gaza-war-too-much-attention-2024": "cut",
  // essential
  "melbourne-cup-attitudes": "cut",
  "melbourne-cup-betting": "cut",
  "melbourne-cup-interest": "cut",
  "santa-tradition": "cut",
  "australians-qualities": "cut",
  "personal-qualities": "cut",
  "kindness-self-vs-australians": "cut",
  "kind-nation": "cut",
  "qualities-australians": "cut",
  "qualities-self": "cut",
  "good-bad-year": "cut",
  "reflections-2025": "cut",
  "addressing-issues-attitude": "cut",
  "group-membership": "cut",
  "group-participation": "cut",
  "celebrity-political-opinions": "cut",
  "health-ratings": "cut",
  "productivity-definition": "cut",
  "supply-chains": "cut",
  "cop-awareness": "cut",
  "cop30-outcomes": "cut",
  "iran-war-engagement": "cut",
  "bondi-jewish-checkins": "cut",
  "allan-approval": "cut",
  "battin-approval": "cut",
  "election-important-issue": "cut",
  "election-vote-decision": "cut",
  "tax-system-views": "cut",
  "us-tariffs-response": "cut",
  "relationship-china": "cut",
  "relationship-uk": "cut",
  "relationship-us": "cut",
  "better-party-international": "cut",
  // redbridge
  "vote-change-reasons": "cut",
  "reasons-for-voting-one-nation": "cut",
  "news-story-week": "cut",
  "feelings-way-things-going": "cut",
  // secnewgate
  "car-purchase-intentions": "cut",
  "news-consumption": "cut",
  "direction-reasons": "cut",
};

const THEME_IDS = new Set(THEMES.map((t) => t.id).concat("cut"));

export function themeOf(entryId) {
  const t = THEME_OF[entryId];
  if (!t) throw new Error(`adhoc-themes: no topic for entry id "${entryId}" – map it to a topic or "cut"`);
  if (!THEME_IDS.has(t)) throw new Error(`adhoc-themes: entry "${entryId}" maps to unknown topic "${t}"`);
  return t;
}
