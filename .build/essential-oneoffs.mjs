#!/usr/bin/env node
/* ====================================================================
   essential-oneoffs.mjs – build data/essential-one-offs.json, the
   Essential Report one-off and occasional-question catalogue behind
   the /beyond-the-vote/ page (sibling stores: data/news24-one-offs.json,
   data/redbridge-one-offs.json).

   Everything is derived, never hand-transcribed:
     figures      – data/essential-report.csv rows, verbatim (the
                    committed extract of Essential's own Flourish
                    charts);
     wave anchors – .build/essential-src/report-index.json keys (the
                    WP publish date of each Essential Report release);
     samples      – data/polls.json Essential rows (same wave, ±7d);
     page urls    – releaseUrl from polls.json, else the report index.

   The curation part lives in MANIFEST/EXCLUDE below: which CSV question
   datasets count as one-offs, their entry ids and notes. Scope is the
   48th parliament – waves of 2025-05-12 onward. The standing battery is
   EXCLUDED because the site already channels it: primary, 2pp, leader
   approvals (Albanese, Dutton, Ley→Taylor), national_mood (→ polls.json
   direction[]), the primary-vote demographics (→ data/demographics.json)
   and the party-consideration read (→ the row's consideration map).
   Every dataset id with a reading ≥ window start must be in MANIFEST or
   EXCLUDE – an unadjudicated dataset fails the build.

   Duplicate id spaces: the CSV carries the same question under two ids
   (the report page's `views_on_*` vs the question page's longhand id,
   plus `_by_gender` siblings repeating a canonical dataset's folds).
   Duplicates sit in `also:` on the canonical stanza; the builder asserts
   figure equality on every shared cell, then merges any cell the
   canonical lacks.

   Usage: node .build/essential-oneoffs.mjs [--check]
   Exit 2 = adjudication or guard failure (unadjudicated dataset,
   duplicate mismatch, unmapped read, two reads in one wave).
   ==================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST = [
  /* immigration */
  { id: "attitudes-immigration", ds: "attitudes_to_immigration", also: ["do_you_think_immigration_to_australia_is_generally_positive_or_generally_negative_for_the_country", "do_you_think_immigration_to_australia_is_generally_positive_or_generally_negative_for_the_country_trend", "do_you_think_immigration_to_australia_is_generally_positive_or_generally_negative_for_the_country_by_gender", "do_you_think_immigration_to_australia_is_generally_positive_or_generally_negative_for_the_country_by_age", "do_you_think_immigration_to_australia_is_generally_positive_or_generally_negative_for_the_country_by_voting_intention"],
    note: "The long-running trend read (asked since 2019; in-term reads appear per wave)." },
  { id: "immigration-intake", ds: "views_on_australia_s_immigration_intake", also: ["to_what_extent_would_you_like_to_see_australias_yearly_immigration_intake_increase_decrease_or_stay_about_the_same", "to_what_extent_would_you_like_to_see_australias_yearly_immigration_intake_increase_decrease_or_stay_about_the_same_trend", "to_what_extent_would_you_like_to_see_australias_yearly_immigration_intake_increase_decrease_or_stay_about_the_same_by_gender", "to_what_extent_would_you_like_to_see_australias_yearly_immigration_intake_increase_decrease_or_stay_about_the_same_by_age", "to_what_extent_would_you_like_to_see_australias_yearly_immigration_intake_increase_decrease_or_stay_about_the_same_by_voting_intention"] },
  { id: "immigration-cap", ds: "views_on_australia_s_immigration_cap" },
  { id: "immigration-impact", ds: "perceived_impact_of_immigration", also: ["impact_of_immigration", "impact_of_immigration_by_gender", "impact_of_immigration_by_age", "impact_of_immigration_by_voting_intention"] },
  { id: "immigration-views", ds: "views_on_immigration_into_australia", also: ["different_views_on_immigration", "different_views_on_immigration_by_gender", "different_views_on_immigration_by_age", "different_views_on_immigration_by_voting_intention"],
    note: "Pick-one statement battery on immigration's costs and benefits." },
  { id: "immigration-if-services", ds: "views_on_immigration_if_better_housing_and_expanded_public_services", also: ["if_governments_built_enough_homes_and_expanded_public_services_to_keep_pace_with_population_growth_would_you_still_want_immigration_reduced", "if_governments_built_enough_homes_and_expanded_public_services_to_keep_pace_with_population_growth_would_you_still_want_immigration_reduced_by_gender", "if_governments_built_enough_homes_and_expanded_public_services_to_keep_pace_with_population_growth_would_you_still_want_immigration_reduced_by_age", "if_governments_built_enough_homes_and_expanded_public_services_to_keep_pace_with_population_growth_would_you_still_want_immigration_reduced_by_voting_intention"],
    note: "The counterfactual deep cut: is the objection to immigration the numbers, or the services?" },
  { id: "immigration-reduction-source", ds: "areas_for_immigration_intake_reduction", also: ["views_on_where_immigration_reductions_should_come_from", "views_on_where_immigration_reductions_should_come_from_by_gender", "views_on_where_immigration_reductions_should_come_from_by_age", "views_on_where_immigration_reductions_should_come_from_by_voting_intention"] },
  { id: "immigration-control-steps", ds: "support_opposition_on_steps_to_control_immigration", also: ["to_what_extent_do_you_support_or_oppose_each_of_the_following", "to_what_extent_do_you_support_or_oppose_each_of_the_following_by_gender", "to_what_extent_do_you_support_or_oppose_each_of_the_following_by_age", "to_what_extent_do_you_support_or_oppose_each_of_the_following_by_voting_intention"] },

  /* one nation & the party system */
  { id: "openness-one-nation", ds: "openness_to_one_nation" },
  { id: "one-nation-vote-impacts", ds: "impacts_on_the_likelihood_of_voting_for_one_nation" },
  { id: "one-nation-concern", ds: "concern_about_the_ideas_and_values_of_pauline_hansons_one_nation_party" },
  { id: "one-nation-consideration-reason", ds: "reason_for_one_nation_consideration",
    note: "Asked of those open to One Nation: the pulling motivation (immigration tops it at 31% overall)." },
  { id: "barnaby-next-move", ds: "barnaby_joyce_s_next_move" },
  { id: "liberal-direction", ds: "direction_of_the_liberal_party" },
  { id: "best-liberal-leader", ds: "best_person_to_lead_the_liberal_party" },
  { id: "preferred-coalition-leader", ds: "preferred_coalition_party_leader" },
  { id: "gender-quotas-coalition", ds: "support_for_coalition_introducing_gender_quotas" },
  { id: "angus-taylor-impact", ds: "angus_taylor_impact" },
  { id: "hanson-approval", ds: "approval_of_pauline_hanson",
    note: "A single read of Hanson as leader – unchannelled because the site's leadership model tracks the two main offices only." },
  { id: "allan-approval", ds: "approval_of_jacinta_allan", note: "State-leadership ratings file as one-offs (unchannelled)." },
  { id: "battin-approval", ds: "approval_of_brad_battin", note: "State-leadership ratings file as one-offs (unchannelled)." },
  { id: "labor-mandate", ds: "labor_s_election_mandate" },
  { id: "election-vote-decision", ds: "federal_election_vote_decision", note: "Post-election survey: how and when voters said they decided." },
  { id: "labor-second-term-expectations", ds: "expectations_of_labor_in_second_term" },
  { id: "election-important-issue", ds: "most_important_election_issue" },
  { id: "new-government-issues", ds: "most_important_issues_for_the_new_government_to_act_on" },

  /* cost of living & the economy */
  { id: "interest-rate-contributors", ds: "contributors_to_interest_rate_increase" },
  { id: "fuel-crisis-responsibility", ds: "responsibility_for_the_fuel_crisis", note: "The chart titles for this wave's trio carry placeholder 'Exx/xx.' prefixes in the extract; the entries keep the substantive wording." },
  { id: "fuel-crisis-personal", ds: "fuel_crisis_personal_responsibility" },
  { id: "energy-supply-attitudes", ds: "attitudes_towards_national_energy_supply" },
  { id: "economy-outlook-6m", ds: "six_month_economy_predictions" },
  { id: "better-or-worse-off", ds: "better_or_worse_off" },
  { id: "groups-views-economy", ds: "attitudes_to_groups_views_of_the_economy" },
  { id: "party-trust-economy", ds: "party_trust_to_manage_the_economy" },
  { id: "economic-roundtable", ds: "views_on_the_economic_roundtable", note: "The August 2025 productivity roundtable battery." },
  { id: "productivity-definition", ds: "definition_of_productivity" },
  { id: "regulation-australia", ds: "regulation_in_australia" },
  { id: "regulation-by-area", ds: "views_on_regulation_in_different_areas" },
  { id: "four-day-week", ds: "support_for_a_four_day_work_week" },
  { id: "happiness-personal", ds: "happiness_with_personal_situation", also: ["happiness_with_personal_situation_trend", "happiness_with_personal_situation_by_gender", "happiness_with_personal_situation_by_age", "happiness_with_personal_situation_by_voting_intention"] },

  /* the budget, tax & housing */
  { id: "attention-to-budget", ds: "attention_to_federal_budget_announcements" },
  { id: "budget-expectations", ds: "perceived_impact_of_federal_budget_on_people_economy_etc" },
  { id: "budget-cost-of-living-impact", ds: "impact_of_the_federal_budget_on_cost_of_living", also: ["impact_of_the_federal_budget_on_cost_of_living_trend", "impact_of_the_federal_budget_on_cost_of_living_by_gender", "impact_of_the_federal_budget_on_cost_of_living_by_age", "federal_budget_will_make_a_meaningful_difference_on_cost_of_living_by_voting_intention"] },
  { id: "budget-approval-2026", ds: "approval_of_federal_budget_that_was_handed_down_on_tuesday_12th_may" },
  { id: "budget-measures-2026", ds: "support_for_measures_from_the_federal_budget" },
  { id: "budget-in-reply-2026", ds: "support_for_proposals_from_the_budget_in_reply" },
  { id: "budget-priorities", ds: "federal_budget_priorities" },
  { id: "budget-changes-support", ds: "support_for_changes_in_the_federal_budget" },
  { id: "negative-gearing-cgt-youth", ds: "perceived_impact_of_negative_gearing_and_the_capital_gains_tax_changes_on_younger_people" },
  { id: "taxing-wages-vs-investments", ds: "views_on_taxing_wages_vs_investments" },
  { id: "housing-concerns-ranking", ds: "ranking_of_housing_concerns" },
  { id: "election-commitments", ds: "views_on_election_commitments" },
  { id: "support-economic-measures", ds: "support_for_economic_measures" },
  { id: "government-performance", ds: "albanese_governments_performance" },
  { id: "government-issue-performance", ds: "government_performance_on_issues" },
  { id: "gov-action-economy", ds: "government_action_on_economic_issues" },
  { id: "gov-action-environment", ds: "government_action_on_environmental_issues" },
  { id: "tax-system-views", ds: "views_on_current_tax_system" },
  { id: "government-funding-increases", ds: "support_and_opposition_for_increasing_government_funding" },
  { id: "issue-importance", ds: "importance_of_issues" },

  /* climate & the energy transition */
  { id: "climate-acceptance", ds: "climate_change_acceptance", note: "The long-running acceptance trend (believes in climate change; caused by humans)." },
  { id: "climate-action", ds: "addressing_climate_change", note: "Trend read: is Australia doing enough on climate change." },
  { id: "net-zero-2050", ds: "support_for_net_zero_by_2050" },
  { id: "emissions-targets-views", ds: "views_on_emissions_reduction_targets" },
  { id: "emissions-target-2035", ds: "views_on_australia_s_2035_emissions_reduction_target" },
  { id: "emissions-target-2035-likelihood", ds: "likelihood_to_meet_the_2035_emissions_reduction_target" },
  { id: "preventing-global-warming", ds: "preventing_global_warming" },
  { id: "cop-awareness", ds: "awareness_of_cop" },
  { id: "cop30-outcomes", ds: "outcomes_of_cop30" },
  { id: "cop31-hosting", ds: "support_for_australia_hosting_cop31" },

  /* the US, Trump & tariffs */
  { id: "trump-favourability", ds: "donald_trump_favourability" },
  { id: "trump-presidency-impact", ds: "impact_of_trump_s_presidency", note: "The trend read's earlier months file in the wave's Series table." },
  { id: "us-alignment", ds: "views_on_australia_s_alignment_with_the_usa" },
  { id: "albanese-trump-meeting-importance", ds: "importance_of_albanese_meeting_trump" },
  { id: "albanese-trump-meeting", ds: "albanese_s_meeting_with_trump" },
  { id: "meeting-outcomes-support", ds: "support_for_meeting_outcomes" },
  { id: "albanese-trump-confidence", ds: "confidence_in_albanese_to_work_with_trump" },
  { id: "us-tariff-pressures", ds: "views_on_tariff_pressures_from_the_us" },
  { id: "us-tariffs-response", ds: "government_response_to_us_tariff_threats", note: "Trend read of whether the government's tariff response is about right." },
  { id: "supply-chains", ds: "views_on_global_supply_chains_and_australian_businesses" },
  { id: "us-vs-middle-powers", ds: "australia_s_international_relationships_us_vs_middle_powers" },

  /* international relationships & security */
  { id: "international-relationships", ds: "international_relationships_all_countries",
    note: "Get-closer / less-close battery across seven countries (March 2026)." },
  { id: "relationship-china", ds: "international_relationships_china",
    note: "The per-country question page for China: the two-read trend (Mar 26, Feb 21 – earlier months file in the Series table) and the wave's demographic folds." },
  { id: "relationship-us", ds: "international_relationships_us",
    note: "The per-country question page for the United States (trend + folds)." },
  { id: "relationship-uk", ds: "international_relationships_uk",
    note: "The per-country question page for the United Kingdom (trend + folds)." },
  { id: "relationships-with-countries", ds: "australia_s_relationships_with_other_countries", note: "Positive/negative rating of Australia's relationship with seven partners; trend months file in the Series table." },
  { id: "country-to-strengthen", ds: "most_beneficial_country_to_strengthen_our_relationship_with" },
  { id: "views-on-countries", ds: "views_on_other_countries", note: "Country-favourability battery." },
  { id: "better-party-international", ds: "better_party_on_international_relations_issues" },
  { id: "aukus-security", ds: "national_security_and_aukus_partnership" },
  { id: "aukus-delivery", ds: "likelihood_that_aukus_will_deliver" },

  /* Gaza, Palestine & Israel */
  { id: "israel-gaza-action", ds: "views_on_israel_s_military_action_in_gaza" },
  { id: "gaza-war-response", ds: "the_government_s_response_to_the_israel_gaza_war" },
  { id: "palestine-recognition", ds: "support_for_australia_recognising_palestine" },
  { id: "palestine-recognition-consequences", ds: "consequences_of_australia_recognising_palestine" },

  /* the Iran war */
  { id: "iran-war-engagement", ds: "engagement_with_the_war_in_iran" },
  { id: "iran-strikes-approval", ds: "approval_of_the_u_s_and_israel_s_decision_to_initiate_strikes_on_iran" },
  { id: "iran-australia-response", ds: "approval_of_australia_s_response_to_u_s_and_israel_s_military_action_in_iran" },
  { id: "middle-east-involvement", ds: "support_or_opposition_for_australia_involvement_in_middle_east_conflict" },

  /* Bondi, antisemitism & hate speech */
  { id: "bondi-antisemitism-views", ds: "views_of_antisemitism_and_the_bondi_beach_terrorist_attack" },
  { id: "bondi-jewish-checkins", ds: "connecting_with_jewish_friends_and_colleagues_following_bondi_terrorist_attacks" },
  { id: "bondi-albanese-handling", ds: "anthony_albanese_s_handling_of_the_issues_arising_from_the_bondi_terrorist_attacks" },
  { id: "bondi-initiatives", ds: "support_for_initiatives_following_bondi_terrorist_attack" },
  { id: "hate-speech-laws", ds: "views_on_hate_speech_laws" },
  { id: "bondi-policies", ds: "support_for_policies" },
  { id: "antisemitism-policies", ds: "support_for_policies_to_address_antisemitism", note: "The pre-Bondi (July 2025) antisemitism-measures battery." },

  /* social cohesion & the national character */
  { id: "australia-division-trajectory", ds: "trajectory_of_australian_division_unity" },
  { id: "trust-institutions", ds: "trust_in_friends_institutions_and_corporations" },
  { id: "qualities-self", ds: "social_attributes_self_alignment" },
  { id: "qualities-australians", ds: "social_attributes_australian_alignment" },
  { id: "social-cohesion", ds: "perception_of_social_cohesion" },
  { id: "kind-nation", ds: "view_on_whether_australia_is_a_kind_nation" },
  { id: "australians-qualities", ds: "australians_exhibit_the_following_qualities" },
  { id: "personal-qualities", ds: "personal_qualities" },
  { id: "kindness-self-vs-australians", ds: "kindness_view_of_myself_vs_my_view_of_australians", note: "The cross-tab between the 'I exhibit' and 'Australians exhibit' ratings." },
  { id: "existential-threats", ds: "concern_for_existential_threats" },

  /* looking backwards & ahead */
  { id: "reflections-2025", ds: "reflections_on_2025_expectations" },
  { id: "expectations-2026", ds: "expectations_for_2026" },
  { id: "good-bad-year", ds: "good_year_bad_year" },
  { id: "economy-2026-expectations", ds: "economy_expectations_for_2026" },
  { id: "addressing-issues-attitude", ds: "attitude_to_australia_addressing_issues" },
  { id: "future-outlook", ds: "future_outlook" },
  { id: "world-division-trajectory", ds: "trajectory_of_world_divition_unity",
    also: ["trajectory_of_world_division_unity"],
    note: "The platform files this question twice (the canonical id carries a 'divition' typo; the spelled-right id holds one wave's read) – merged here." },
  { id: "australia-vs-countries", ds: "australia_compared_to_other_countries" },

  /* work, unions & superannuation */
  { id: "unions-importance", ds: "importance_of_unions" },
  { id: "group-membership", ds: "group_membership", note: "Union and community-group membership; the printed months ride the measure labels ('currently a member – Aug 26')." },
  { id: "stronger-unions-impact", ds: "perceived_impact_of_stronger_unions" },
  { id: "group-participation", ds: "attitudes_to_group_participation" },
  { id: "superannuation-views", ds: "attitudes_to_superannuation" },
  { id: "working-life-concerns", ds: "concerns_regarding_working_life" },
  { id: "worker-protections-confidence", ds: "confidence_on_current_worker_and_union_protections" },
  { id: "ai-workplace-regulation", ds: "attitudes_to_ai_regulation_in_workplace" },

  /* health */
  { id: "health-ratings", ds: "overall_health_rating", note: "0–10 health ratings of self, family and the nation." },
  { id: "health-services-performance", ds: "performance_of_health_services_in_australia" },
  { id: "healthcare-cost-impact", ds: "impact_of_cost_on_healthcare_choices" },
  { id: "public-health-confidence", ds: "confidence_in_australia_s_public_health_system" },

  /* data centres */
  { id: "data-centre-local", ds: "support_for_new_data_centre_being_built_in_local_area" },
  { id: "data-centre-concerns", ds: "top_concerns_about_data_centres" },

  /* abortion */
  { id: "abortion-views", ds: "views_on_abortion" },
  { id: "abortion-care", ds: "abortion_care_attitudes" },
  { id: "abortion-access-20-weeks", ds: "views_on_abortion_access_after_20_weeks" },

  /* gambling & celebrity speech */
  { id: "gambling-advertising", ds: "views_on_gambling_advertising" },
  { id: "gambling-ad-rules", ds: "views_on_gambling_advertising_in_australia",
    also: [
      "e1203_thinking_about_gambling_advertising_in_australia_which_of_the_following_comes_closest_to_what_you_think_the_rules_should_be_overall",
      "e1203_thinking_about_gambling_advertising_in_australia_which_of_the_following_comes_closest_to_what_you_think_the_rules_should_be_by_gender",
      "e1203_thinking_about_gambling_advertising_in_australia_which_of_the_following_comes_closest_to_what_you_think_the_rules_should_be_by_age",
      "e1203_thinking_about_gambling_advertising_in_australia_which_of_the_following_comes_closest_to_what_you_think_the_rules_should_be_by_voting_intention",
    ] },
  { id: "celebrity-political-opinions", ds: "view_on_artists_and_celebrities_expressing_political_opinions",
    also: [
      "e1202_which_of_the_following_is_closest_to_your_view_about_artists_and_celebrities_expressing_political_opinions_overall",
      "e1202_which_of_the_following_is_closest_to_your_view_about_artists_and_celebrities_expressing_political_opinions_by_gender",
      "e1202_which_of_the_following_is_closest_to_your_view_about_artists_and_celebrities_expressing_political_opinions_by_age",
      "e1202_which_of_the_following_is_closest_to_your_view_about_artists_and_celebrities_expressing_political_opinions_by_voting_intention",
    ] },

  /* social media & AI */
  { id: "social-media-regulation", ds: "views_on_regulating_social_media_companies" },
  { id: "social-media-ban", ds: "support_for_current_social_media_ban",
    also: ["support_for_current_social_media_ban_on_children"],
    note: "The under-16s social-media ban. The platform files the same question under a second 'on children' id (assert-merged here); its earlier reads ride the same trend." },
  { id: "social-media-ban-effectiveness", ds: "effectiveness_of_social_media_ban" },
  { id: "social-media-feed-control", ds: "views_on_social_media_feed_control" },
  { id: "ai-development", ds: "views_on_ai_development" },
  { id: "generative-ai-use", ds: "use_of_generative_ai" },
  { id: "ai-opportunities-risks", ds: "ai_opportunities_and_risks" },
  { id: "ai-copyright", ds: "views_on_ai_copyright_law" },
  { id: "ai-workplace-views", ds: "views_on_ai_in_the_workplace" },
  { id: "ai-impacts-concern", ds: "concern_for_the_impacts_of_ai" },

  /* Australia Day & racism */
  { id: "australia-day-views", ds: "changing_views_towards_australia_day" },
  { id: "indigenous-national-day", ds: "support_for_a_national_day_for_indigenous_australians" },
  { id: "racism", ds: "racism_in_australia" },

  /* one-offs, seasonal & standalone batteries */
  { id: "melbourne-cup-interest", ds: "interest_in_the_melbourne_cup" },
  { id: "melbourne-cup-betting", ds: "betting_activity_and_the_melbourne_cup" },
  { id: "melbourne-cup-attitudes", ds: "attitudes_to_the_melbourne_cup" },
  { id: "santa-tradition", ds: "impact_of_santa_tradition" },
  { id: "violence-against-women", ds: "views_on_violence_against_women_in_australia" },
  { id: "manosphere-awareness", ds: "manosphere_awareness" },
  { id: "manosphere-attitudes", ds: "attitudes_to_manosphere_content" },
  { id: "policy-support-battery", ds: "policy_support", note: "Support/oppose battery on the February 2026 policy slate (industry protection, the wealth gap, tech regulation, …)." },
  { id: "initiatives-menu", ds: "support_for_initiatives", note: "'% selected' menu of One Nation-aligned policy initiatives (June 2026), filed with the wave's One Nation consideration cut." },
];
const EXCLUDE = {
  primary: "primary voting intention – channelled into polls.json",
  "2pp": "two-party-preferred – channelled into polls.json",
  approval_of_anthony_albanese: "standing battery – PM approval lives in polls.json (approval series)",
  approval_of_peter_dutton: "standing battery – PM/OL approval lives in polls.json (approval series; ended May 2025)",
  approval_of_angus_taylor: "standing battery – opposition-leader approval (Ley→Taylor) lives in polls.json",
  national_mood: "channelled – right/wrong direction reads land in polls.json direction[]",
  political_party_consideration: "channelled – the 2026-06-29 polls.json row carries it as the consideration map",
};

/* ==================================================================== */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = path.join(ROOT, "data", "essential-report.csv");
const POLLS_PATH = path.join(ROOT, "data", "polls.json");
const INDEX_PATH = path.join(ROOT, ".build", "essential-src", "report-index.json");
const OUT_PATH = path.join(ROOT, "data", "essential-one-offs.json");
const CHECK = process.argv.includes("--check");
const WINDOW_START = "2025-05-12";

const errors = [];
const die = (m) => errors.push(m);

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[",''"']/g, "").replace(/\s+/g, " ").trim();

const cleanQuestion = (q) => q
  .replace(/^E\d+\s*[-:]\s*/i, "")
  .replace(/^Q[ivxlc]+\.\s*/i, "")
  .replace(/^(?:E?xx+)\.?\s*/i, "")
  .replace(/\s*[\u002d\u2013\u2014(]?\s*trend\)?\s*$/i, "")
  .replace(/\s*[\u002d\u2013\u2014(]?\s*(?:total|overall)\)?\s*$/i, "")
  .trim();

const val0 = (s) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : s;
};

const META_ANS = new Set(["overall", "overall share", "total", "total: approve", "total: disapprove"]);
const isMeta = (s) => META_ANS.has(norm(s)) || /^total:/.test(norm(s));
const _trendSuffix = /_trend$/;

/* Trend-chart month labels ("mar 26", "nov23", "feb 21") sit in the ANSWER
   column of the series rows a trend visual prints for its earlier reads.
   They are not answer options – diverting them to a per-wave Series table
   keeps them out of the answer grid. */
const MONTH_ANS = /^[a-z]{3} ?\d{2}$/;
const prettyPeriod = (s) => {
  const m = norm(s).match(/^([a-z]{3}) ?(\d{2})$/);
  return m ? m[1][0].toUpperCase() + m[1].slice(1) + " " + m[2] : s;
};

/* A row naming a cut in vis/dim but matching none of that cut's group
   labels would silently file as an all-voters row – refuse it instead. */
const FOLDISH_VIS = new Set([
  "gender", "age", "voting intention", "previous vote",
  "by gender", "by age", "by voting intention", "consideration of one nation",
]);
const FOLDISH_DIM = new Set(["gender", "age", "vote", "voting_intention", "previous_vote"]);

/* A row is a demographic-fold row only inside a fold CONTEXT, and what
   counts as a group label depends on which context it is – the party
   tokens ("coalition", "greens", ...) also appear as plain answer options
   ("which party do you trust – Labor 30, Coalition 28") in an Overall row,
   so a party token is a group label only under a vote-cut context. The
   context itself is named by the dim/vis words. */
const G_PARTY = [
  "labor", "coalition", "total: coalition", "greens", "one nation", "liberal",
  "independent", "other", "independent or other party", "independent/other",
  "minor parties/independents", "total: minor parties/independents",
  "labor voter 2025", "coalition voter 2025", "greens voter 2025",
  "one nation voter 2025", "independent voter 2025", "voted other 2025",
];
const G_GENDER = ["male", "female"];
const G_AGE = ["18-34", "35-54", "55+", "under 35", "35+"];
const G_ONC = [
  "i would definitely vote for them (one nation)",
  "i would be open to vote for them (one nation)",
  "i would never vote for them (one nation)",
  "unsure",
];
const GROUP_ORDER = [...G_GENDER, ...G_AGE, ...G_PARTY, ...G_ONC];

const DIM_NAMES = {
  gender: "By gender", age: "By age",
  voting_intention: "By voting intention", vote: "By voting intention",
  previous_vote: "By vote at the 2025 election",
};
const VIS_NAMES = {
  "voting intention": "By voting intention", "by voting intention": "By voting intention",
  gender: "By gender", "by gender": "By gender",
  age: "By age", "by age": "By age",
  "previous vote": "By vote at the 2025 election",
  "consideration of one nation": "By One Nation consideration",
};
const CONTEXT_GROUPS = {
  "By voting intention": new Set(G_PARTY),
  "By vote at the 2025 election": new Set(G_PARTY),
  "By gender": new Set(G_GENDER),
  "By age": new Set(G_AGE),
  "By One Nation consideration": new Set(G_ONC),
};

/* Reciprocal-cut compensation for garbled cross-tab folds. Some extract
   rows carry the WRONG cut word in vis: the groups named are of the dim
   cut, not the vis cut (steps_to_control_immigration's vis=Gender rows
   name age bands – the "By gender" chart is absent; jewish_friends'
   vis=Age/dim=gender rows carry a complete set of gender groups whose
   complement set sits in the vis=Gender/dim=age rows, i.e. the two words
   are swapped). Rule: if vis names a group cut whose vocab matches
   NEITHER side, but the dim's cut vocab matches one side, roll out to
   the dim cut. An `also`-signature collision (E921's two ids, E1123's
   divition twin) rolls out identically on both sides of the canonical
   pair, so the duplicate assert still applies. International_relations'
   vis=Voting-intention folds fail the rollout test both ways (its
   groups sit in ans, not key) and stay guard failures. */
const DIM_OF_VIS = { "by gender": "gender", gender: "gender", "by age": "age", age: "age", "voting intention": "voting_intention", "by voting intention": "voting_intention", "previous vote": "previous_vote" };

/* ---- load the corpus ---------------------------------------------------- */
const rawRows = parseCSV(fs.readFileSync(CSV_PATH, "utf8"));
rawRows.shift();
const corpus = new Map(); // ds -> { rows }
for (const r of rawRows) {
  const [ds, qid, q, vis, ans, dim, key, date, val] = r;
  if (!ds) continue;
  let c = corpus.get(ds);
  if (!c) corpus.set(ds, (c = { rows: [] }));
  c.rows.push({ ds, qid, q, vis, ans, dim, key, date, val });
}

const polls = JSON.parse(fs.readFileSync(POLLS_PATH, "utf8"));
const eRows = (polls.polls || []).filter((p) => /Essential/i.test(p.pollster || ""));
const reportIndex = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
const WAVE_DATES = Object.keys(reportIndex).sort();

function waveOfRead(date) {
  if (date < WINDOW_START) return null;
  const i = WAVE_DATES.findIndex((w) => w >= date);
  if (i >= 0) {
    if (i > 0) {
      const back = (new Date(date) - new Date(WAVE_DATES[i - 1])) / 86400000;
      const ahead = (new Date(WAVE_DATES[i]) - new Date(date)) / 86400000;
      if (back <= 2 && back < ahead) return WAVE_DATES[i - 1];
    }
    return WAVE_DATES[i];
  }
  const last = WAVE_DATES[WAVE_DATES.length - 1];
  const dd = (new Date(date) - new Date(last)) / 86400000;
  return dd <= 2 ? last : null;
}

const WAVE_ROW = new Map();
for (const w of WAVE_DATES) {
  const near = eRows
    .map((r) => ({ r, d: Math.abs(new Date(w) - new Date(r.date)) / 86400000 }))
    .filter((x) => x.d <= 7)
    .sort((a, b) => a.d - b.d)[0];
  WAVE_ROW.set(w, near ? near.r : null);
}

/* ---- merged cell streams ------------------------------------------------
   A merged row set for [ds, ...also]: canonical wins conflicts; `also`
   partners must agree on every shared cell (asserted). Question-page ids
   (`..._overall`, `..._by_gender`, ...) re-file a canonical dataset's rows
   with the cut named only in the id (vis left blank) – the vis comes back
   from the id suffix so the duplicate read asserts cell-for-cell against
   the canonical one instead of minting phantom all-voters rows. */
const idDerivedVis = (id) =>
  id.endsWith("_overall") ? "overall"
  : id.endsWith("_by_gender") ? "gender"
  : id.endsWith("_by_age") ? "age"
  : id.endsWith("_by_voting_intention") ? "voting intention"
  : null;
function mergedRows(ids) {
  const seen = new Map();
  const out = [];
  for (let ix = 0; ix < ids.length; ix++) {
    const id = ids[ix];
    const c = corpus.get(id);
    if (!c) { die(`manifest: dataset id "${id}" is not in the CSV`); continue; }
    for (let r of c.rows) {
      if (r.date < WINDOW_START) continue;
      const dv = !norm(r.vis) && idDerivedVis(id);
      if (dv) r = { ...r, vis: dv };
      const k = [norm(r.vis), norm(r.ans), norm(r.dim), norm(r.key), r.date].join("");
      if (seen.has(k)) {
        if (seen.get(k).val !== r.val)
          die(`duplicate mismatch ${ids[0]} vs ${id} @ ${r.date} "${r.ans}"/"${r.key}": ${seen.get(k).val} != ${r.val}`);
        continue;
      }
      seen.set(k, r);
      out.push(r);
    }
  }
  /* Same-cell prefix-truncation dedupe. When a wave ships two datasets for
     one question (gambling-ad-rules @ 2026-09-29), one set's option labels
     cap at 100 chars and the sibling set prints them in full. The truncated
     label is a strict prefix of its full partner ending mid-word ("…ads on
     social media and onl" | "…and online") and every figure agrees, so both
     rows would file as distinct cells in every table. Drop the truncated
     row. Guards: the boundary must be mid-word (word char into word char –
     "will" vs "will not" and a "…option" vs "…option – June 2024 trend row"
     never pass) and the figure must parse and match (a genuinely truncated
     row with no provably-identical partner stays, as any other row would). */
  return out.filter((a) => {
    const na = norm(a.ans);
    if (!na) return true;
    for (const b of out) {
      if (a === b) continue;
      const nb = norm(b.ans);
      if (nb.length <= na.length || !nb.startsWith(na)) continue;
      if (norm(a.vis) !== norm(b.vis) || norm(a.dim) !== norm(b.dim) ||
          norm(a.key) !== norm(b.key) || a.date !== b.date) continue;
      if (!/[a-z0-9]/.test(na[na.length - 1]) || !/[a-z0-9]/.test(nb[na.length])) continue;
      const va = parseFloat(a.val), vb = parseFloat(b.val);
      if (!Number.isFinite(va) || va !== vb) continue;
      console.log(`NOTE: truncated duplicate option dropped in ${ids.join("/")} @ ${a.date} "${a.ans.slice(-50)}" – full label and identical figure arrive in the sibling dataset`);
      return false;
    }
    return true;
  });
}

/* ---- emit helpers -------------------------------------------------------
   foldGroup(r): null means the row is an all-voters row. Otherwise the
   row's cut name plus which side holds the group label and which holds
   the printed metric. A row whose cut is named but where NEITHER side
   carries one of that cut's group labels is still an all-voters row
   (vis/dim words name cuts on AV rows too); a row with a group label on
   BOTH sides is an ambiguity the build refuses. */
function foldGroup(r) {
  const t0 = VIS_NAMES[norm(r.vis)] || DIM_NAMES[norm(r.dim)] || null;
  let t = t0;
  if (t && norm(r.vis) && DIM_OF_VIS[norm(r.vis)]) {
    const s0 = CONTEXT_GROUPS[t0];
    if (!s0.has(norm(r.ans)) && !s0.has(norm(r.key))) {
      const dv = DIM_NAMES[norm(r.dim)];
      const sd = dv && CONTEXT_GROUPS[dv];
      if (sd && (sd.has(norm(r.ans)) || sd.has(norm(r.key)))) t = dv;
    }
  }
  const s = t && CONTEXT_GROUPS[t];
  if (!s) return null;
  const inAns = s.has(norm(r.ans));
  const inKey = s.has(norm(r.key));
  if (!inAns && !inKey) return null;
  if (inAns && inKey) {
    die(`fold row with group labels on both sides: "${r.ans}" / "${r.key}" (${r.ds} @ ${r.date})`);
    return null;
  }
  return { t, group: inAns ? r.ans : r.key, metric: inAns ? r.key : r.ans };
}

/* The fold's cut name lives in foldGroup above: vis words win over dim
   words (item-dim fold rows name the cut only in vis; and where dim and
   vis conflict – a use_of_generative_ai fold is dim=voting_intention /
   vis=age – vis carries the human-labelled cut). */

/* The all-voters figure rows at one wave's read. */
function overallTableRows(rows) {
  const out = [];
  const seen = new Set();
  for (const r of rows) {
    const k = norm(r.ans) + "" + norm(r.key);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ans: r.ans, key: r.key, val: val0(r.val) });
  }
  return out;
}

function buildEntry(st, wave, avRowsList, foldMap, qMeta, seriesList) {
  const ids = [st.ds, ...(st.also || [])];
  /* classify: simple vs battery grid */
  const items = [];
  const answers = [];
  for (const r of avRowsList) {
    if (norm(r.key) && !isMeta(r.key) && !items.includes(r.key)) items.push(r.key);
    if (norm(r.ans) && !isMeta(r.ans) && !answers.includes(r.ans)) answers.push(r.ans);
  }
  const isBattery = items.length > 1 && answers.length >= 1 &&
    avRowsList.some((r) => !isMeta(r.ans));
  const tables = [];
  const src = qMeta.url;
  if (isBattery) {
    /* headline: rank-first share, else total support/agree, else first column */
    const ansOrder = answers;
    const head = (() => {
      const rank1 = ansOrder.find((a) => /^rank 1$|^1\s*-\s*/.test(norm(a)));
      if (rank1) return { label: "Share ranking it first", cols: [rank1], sum: false };
      for (const [pair, label] of [
        [["Strongly support", "Somewhat support"], "Total support (strongly + somewhat)"],
        [["Strongly agree", "Somewhat agree"], "Total agree (strongly + somewhat)"],
      ]) {
        if (pair.every((p) => ansOrder.some((a) => norm(a) === norm(p))))
          return { label, cols: pair, sum: true };
      }
      return { label: ansOrder[0], cols: [ansOrder[0]], sum: false };
    })();
    const cellFor = (item, ansName) => {
      const hit = avRowsList.find((r) => norm(r.key) === norm(item) && norm(r.ans) === norm(ansName));
      return hit ? val0(hit.val) : null;
    };
    const headRows = items.map((it) => {
      const v = head.sum
        ? head.cols.reduce((s, c) => s + (Number(cellFor(it, c)) || 0), 0)
        : cellFor(it, head.cols[0]);
      return [it, v];
    });
    tables.push({ title: head.label, source: src, rows: headRows });
    const gridRows = items.map((it) => [it, ...ansOrder.map((a) => cellFor(it, a))]);
    tables.push({ title: "All voters", source: src, headers: ["", ...ansOrder], rows: gridRows });
  } else {
    const rows = avRowsList.map((r) => {
      const label = norm(r.ans) && !isMeta(r.ans) ? r.ans : (norm(r.key) && !isMeta(r.key) ? r.key : r.ans || r.key);
      return [label, val0(r.val)];
    });
    tables.push({ title: null, source: src, rows });
  }

  if (seriesList && seriesList.length)
    tables.push({ title: "Series", source: src, rows: seriesList });

  /* folds: wave → table name → metric → group → value */
  if (foldMap) {
    for (const [tName, metrics] of foldMap) {
      const groupSet = [];
      for (const m of metrics.values())
        for (const [gk, g] of m.groups) if (!groupSet.some((x) => x.k === gk)) groupSet.push({ k: gk, label: g.label });
      groupSet.sort((a, b) => {
        const ai = GROUP_ORDER.indexOf(norm(a.label)), bi = GROUP_ORDER.indexOf(norm(b.label));
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.label.localeCompare(b.label);
      });
      const rows = [...metrics.values()].map((m) => [
        m.label, ...groupSet.map((g) => {
          const c = m.groups.get(g.k);
          return c ? val0(c.val) : null;
        }),
      ]);
      tables.push({ title: tName, source: src, headers: ["", ...groupSet.map((g) => g.label)], rows });
    }
  }

  const row = WAVE_ROW.get(wave);
  const e = {
    id: st.id,
    waveDate: wave,
    dateStart: row && row.dateStart ? row.dateStart : null,
    dateEnd: row ? row.date : wave,
    published: row && row.published ? row.published : wave,
    sample: row ? row.sample ?? null : null,
    sampleEff: row ? row.sampleEff ?? null : null,
    url: (row && (row.releaseUrl || row.url)) || reportIndex[wave] || null,
    question: qMeta.question,
    notes: st.note || null,
    qid: qMeta.qid || null,
    tables,
  };
  return e;
}

/* ---- ask the manifest, emit entries ------------------------------------ */
const entries = [];
const manifestDs = new Set();
for (const st of MANIFEST) {
  const ids = [st.ds, ...(st.also || [])];
  for (const id of ids) manifestDs.add(id);
  const rows = mergedRows(ids);
  /* split av vs fold; map reads to waves. AV cells sit under a per-cell
     key: the trend month-grid read and the wave's own chart read of the
     same cell land in the same wave bucket (2026-04-01 vs 2026-04-28 for
     the 2026-04-28 wave) – equal values merge quietly, and on a real
     disagreement the non-trend, then newer, then canonical read wins; a
     tie that still disagrees is a guard. */
  const avByWave = new Map(); // wave -> Map(cellKey -> {ds, date, ans, key, val, vis})
  const foldByWave = new Map(); // wave -> Map(name -> Map(metric -> Map(group -> val)))
  const seriesByWave = new Map(); // wave -> [[label, val]] Series-table rows
  const qForDerivedQuestion = [];

  /* Garbled duplicate-cut compensation (steps_to_control_immigration @
     2026-09-29): the extractor carried the "By age" fold's rows TWICE
     more, verbatim, under extra vis=Gender and vis=By gender heads (the
     wave's real gender chart never landed). Those rows can't fold – age
     bands sit in a gender context – and left alone they die at the
     "unmapped context" guard below. Detect the carry block-wise BEFORE
     the row loop: a foldish block whose whole (ans/key pair, value)
     multiset is byte-identical to a cleanly-folding block's IN THE SAME
     WAVE is an extractor duplicate – skip every row of it with a NOTE.
     A block with no clean twin still dies at the guard (a genuinely new
     context is never swallowed), and jewish_friends' true vis/dim SWAP
     is untouched (its two blocks' figures differ from every clean
     block's). Skipping is by block, not row: the block's content is
     fully represented by its clean twin. */
  const blockRows = new Map(); // wave|vis|dim -> foldish rows of that block
  for (const r of rows) {
    if (!FOLDISH_VIS.has(norm(r.vis)) && !FOLDISH_DIM.has(norm(r.dim))) continue;
    const w = waveOfRead(r.date); if (!w) continue;
    const bk = w + "|" + norm(r.vis) + "|" + norm(r.dim);
    let brs = blockRows.get(bk); if (!brs) blockRows.set(bk, (brs = []));
    brs.push(r);
  }
  const cleanSigs = new Set();
  const skipBlocks = new Set();
  {
    const sigOf = (brs) => brs
      .map((r) => [norm(r.ans), norm(r.key)].sort().join("~~") + "|" + r.val)
      .sort().join("");
    const info = new Map();
    for (const [bk, brs] of blockRows) {
      const clean = brs.every((r) => foldGroup(r));
      const sig = sigOf(brs);
      info.set(bk, { clean, sig });
      if (clean) cleanSigs.add(sig);
    }
    for (const [bk, i] of info) if (!i.clean && cleanSigs.has(i.sig)) skipBlocks.add(bk);
  }
  const notedBlocks = new Set();

  for (const r of rows) {
    const w = waveOfRead(r.date);
    if (!w) { die(`unmapped read ${r.date} in ${ids.join("/")} ("${r.ans}")`); continue; }
    const bk = w + "|" + norm(r.vis) + "|" + norm(r.dim);
    if (skipBlocks.has(bk)) {
      if (!notedBlocks.has(bk)) {
        notedBlocks.add(bk);
        console.log(`NOTE: duplicate fold block skipped in ${ids.join("/")} @ ${w} vis="${r.vis}" dim="${r.dim}" (byte-identical to a cleanly folded block)`);
      }
      continue;
    }
    if (MONTH_ANS.test(norm(r.ans))) {
      const prefix = st.seriesPrefix && st.seriesPrefix[r.ds] ? st.seriesPrefix[r.ds] + " – " : "";
      const keyBit = norm(r.key) && norm(r.key) !== "overall" ? r.key + " " : "";
      let arr = seriesByWave.get(w); if (!arr) seriesByWave.set(w, (arr = []));
      arr.push([prefix + keyBit + "(" + prettyPeriod(r.ans) + ")", val0(r.val)]);
      continue;
    }
    const fg = foldGroup(r);
    if (!fg && (FOLDISH_VIS.has(norm(r.vis)) || FOLDISH_DIM.has(norm(r.dim))))
      die(`fold row in an unmapped context: ${ids.join("/")} @ ${r.date} vis="${r.vis}" dim="${r.dim}" ans="${r.ans}" key="${r.key}"`);
    if (!fg) qForDerivedQuestion.push(r);
    if (fg) {
      let wv = foldByWave.get(w); if (!wv) foldByWave.set(w, (wv = new Map()));
      let tb = wv.get(fg.t); if (!tb) wv.set(fg.t, (tb = new Map()));
      const mk = norm(fg.metric);
      let mt = tb.get(mk); if (!mt) tb.set(mk, (mt = { label: fg.metric, groups: new Map() }));
      const gk = norm(fg.group);
      const prev = mt.groups.get(gk);
      if (prev && prev.val !== r.val)
        die(`fold conflict in ${ids.join("/")} (${fg.t}/${gk}/${mk}): ${prev.val} vs ${r.val}`);
      else if (!prev) mt.groups.set(gk, { label: fg.group, val: r.val });
    } else {
      let m = avByWave.get(w); if (!m) avByWave.set(w, (m = new Map()));
      const ck = norm(r.ans) + "~~" + norm(r.key);
      const prev = m.get(ck);
      if (!prev) { m.set(ck, r); continue; }
      if (prev.val === r.val) {
        /* equal reads duplicate – keep the more authoritative row */
        const keepNew = /trend/i.test(norm(prev.vis)) && !/trend/i.test(norm(r.vis));
        if (keepNew) m.set(ck, r);
        continue;
      }
      const rank = (x) => (x.ds === ids[0] ? 4 : 0) + (!/trend/i.test(norm(x.vis)) && !_trendSuffix.test(x.ds) ? 2 : 0);
      const a = rank(prev), b = rank(r);
      if (a > b) continue;
      if (b > a) { m.set(ck, r); continue; }
      if (prev.date < r.date) { m.set(ck, r); continue; }
      if (prev.date > r.date) continue;
      die(`all-voters cell conflict in ${ids.join("/")} at wave ${w} ("${r.ans}"/"${r.key}"): ${prev.val} (${prev.ds} ${prev.date}) vs ${r.val} (${r.ds} ${r.date})`);
    }
  }
  /* question wording: Overall/Trend variant's chart title, cleaned */
  const pref = qForDerivedQuestion.find((r) => /^overall|trend|total$/i.test(norm(r.vis)));
  const qTextRaw = (pref || qForDerivedQuestion[0] || { q: st.ds }).q;
  const qMeta = {
    question: st.question || cleanQuestion(qTextRaw),
    qid: (qForDerivedQuestion[0] || { qid: null }).qid,
    url: null, // set per wave below
  };
  const waves = new Set([...avByWave.keys(), ...foldByWave.keys(), ...seriesByWave.keys()]);
  for (const w of [...waves].sort()) {
    const avd = avByWave.get(w);
    const avRowsList = avd ? overallTableRows([...avd.values()]) : [];
    const row = WAVE_ROW.get(w);
    qMeta.url = (row && (row.releaseUrl || row.url)) || reportIndex[w] || null;
    entries.push(buildEntry(st, w, avRowsList, foldByWave.get(w), qMeta, seriesByWave.get(w) || null));
  }
}

/* ---- coverage audit ------------------------------------------------------ */
for (const [ds, c] of corpus) {
  if (manifestDs.has(ds) || EXCLUDE[ds]) continue;
  if (!c.rows.some((r) => r.date >= WINDOW_START)) continue;
  die(`unadjudicated dataset "${ds}" (${c.rows[0].qid}): "${c.rows[0].q.slice(0, 110)}"`);
}

/* ---- the store ----------------------------------------------------------- */
entries.sort((a, b) => a.waveDate < b.waveDate ? -1 : a.waveDate > b.waveDate ? 1 : a.id.localeCompare(b.id));
const latestWave = entries.reduce((m, e) => (e.waveDate > m ? e.waveDate : m), "");
const store = {
  _about: [
    "Essential Report one-off and occasional survey questions that do NOT channel into the auspol-tracker",
    "data model (voting intention, 2PP, leader approvals, national direction, vote-by-demographics, the",
    "party-consideration map). Scope: the 48th parliament – waves of 2025-05-12 onward, as extracted",
    "into data/essential-report.csv (latest wave on file: " + latestWave + "; later waves join on a re-run",
    "of .build/essential-oneoffs.mjs after the extractor merges them). Figures are the CSV's rows verbatim;",
    "question texts are Essential's own chart titles (E-codes stripped); samples and release links come",
    "from the matching polls.json row (waves 2025-05-12, 2025-07-29 and 2025-08-26 have no polls.json row –",
    "their sample sizes are null and the report-index release link stands). Generated by",
    ".build/essential-oneoffs.mjs from data/essential-report.csv, .build/essential-src/report-index.json",
    "and data/polls.json – never hand-edit.",
  ].join(" "),
  generated: latestWave,
  _readme: [
    "Exclusions already written into the builder's EXCLUDE map (channelled into the site data model or",
    "standing battery):",
    ...Object.entries(EXCLUDE).map(([k, v]) => "- " + k + ": " + v),
    "Emission rules: a recurring trend question emits one entry per in-window read (the same id under",
    "each wave) so the series is visible; all-voters tables sit in tables[0], battery answer grids in",
    "tables[1], and each demographic fold (by gender / age / voting intention / 2025 vote) follows as its",
    "own table. 'Currently a member'-style straight-line trend batteries emit their series columns as the",
    "grid. Headline tables for answer-grid batteries pick the rank-1 share, a total-support/agree sum, or",
    "the first printed answer, in that order of preference – the underlying grid is always beside it.",
  ].join("\n"),
  entries,
};

if (errors.length) {
  for (const e of errors) console.error("GUARD: " + e);
  console.error(`${errors.length} guard failure(s)`);
  process.exit(2);
}

const out = JSON.stringify(store, null, 1) + "\n";
if (CHECK) {
  console.log(`check: ${entries.length} entries across ${new Set(entries.map((e) => e.waveDate)).size} waves; would write data/essential-one-offs.json (${out.length} bytes)`);
} else {
  const tmp = OUT_PATH + ".tmp";
  fs.writeFileSync(tmp, out);
  fs.renameSync(tmp, OUT_PATH);
  console.log(`wrote data/essential-one-offs.json: ${entries.length} entries across ${new Set(entries.map((e) => e.waveDate)).size} waves (${out.length} bytes)`);
}
