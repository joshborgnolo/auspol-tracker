// Fill the Decidedness panel's data gaps found in the 2026-11-23 review,
// each value from the pollster's own text or table (quoted below), and fix
// three filing errors found on the way. Dry-run by default; --apply writes
// data/polls.json. Idempotent: a second run reports nothing to change.
//
// Not filled, because no source the review could read prints them:
//   Roy Morgan 2026-05-17, 05-24, 05-31 can't-say (pages and PDFs print none);
//   Roy Morgan 2026-06-07 (only derivable from the next week's "down 0.5");
//   Fox & Hedgehog 2026-01-06 after-leaner (report names the leaner, no %);
//   RedBridge 2026-03-27 after-leaner (no Accent page; AFR paywalled);
//   RedBridge 2026-03-19 firmness (used only as a crosstab there);
//   YouGov Pulse and Freshwater undecided shares (never printed: YouGov's
//   APC statements say "Don't know" answers "were excluded from final
//   figures"; Freshwater's tables are "Squeezed & Valid" with no undecided row).
import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");

const RB_NOV_PDF = "https://6b72024e-077a-44e2-88f5-dc1a0ed81099.usrfiles.com/ugd/b86980_59aef60e2d644fc38ed58658564239b1.pdf";
const RB_NOV_PAGE = "https://www.accent-research.com/projects/australian-financial-review-redbridge-group-and-accent-research-large-sample-federal-poll";
const RB_SHIFTS_PDF = "https://6b72024e-077a-44e2-88f5-dc1a0ed81099.usrfiles.com/ugd/b86980_93009c71944d4ab1b6ae52afef76e20f.pdf";

const FILLS = [
  { pollster: "RedBridge/Accent", date: "2025-06-30", set: { undecidedLeaner: 7, methodUrl: RB_NOV_PDF },
    src: RB_NOV_PDF, quote: "Those who refused to or were unable to provide a vote intention in both the initial question and leaner made up eight per cent of the September sample, and seven per cent of the June sample",
    note: "methodUrl was the March 2026 'shifts' PDF, which says only 'similar rates for the other surveys'" },
  { pollster: "RedBridge/Accent", date: "2025-09-08", set: { undecidedLeaner: 8, methodUrl: RB_NOV_PDF },
    src: RB_NOV_PDF, quote: "… made up eight per cent of the September sample …" },
  { pollster: "RedBridge/Accent", date: "2025-11-26",
    set: { undecidedLeaner: 8, releaseUrl: RB_NOV_PAGE, methodUrl: RB_NOV_PDF,
           firmness: { all: [47, 44, 9], alp: [49, 44, 7], lnp: [51, 39, 10], onp: [50, 43, 7], grn: [43, 48, 9], oth: [29, 52, 19] } },
    src: RB_NOV_PAGE, quote: "Undecided respondents were asked a leaner question. Those who refused to or were unable to provide a vote intention in both the initial question and leaner made up eight per cent of the sample",
    note: "the 7–26 Nov large-sample poll (N 4,775); firmness from the Nov PDF's Figure 16, row 'Nov 7-26' (its Nov 7-13, Oct, Sept and June rows match the stored waves exactly)" },
  { pollster: "RedBridge/Accent", date: "2026-03-19", set: { undecidedLeaner: 8 },
    src: RB_SHIFTS_PDF, quote: "… made up eight per cent of the March 2026 sample" },
  { pollster: "DemosAU", date: "2026-01-21", set: { undecidedLeaner: 6 },
    src: "https://demosau.com/wp-content/uploads/DemosAU/capital-brief-poll-trends-2026.html",
    quote: "Mid January poll, column 'Undecided (excluded)': 6 (page note: 'Respondents who were still undecided after a leaner question are left out')",
    note: "the same page gives 5 for early January, the value already filed for 2026-01-06" },
  { pollster: "Roy Morgan", date: "2026-01-11",
    set: { undecided: 4.5, url: "https://www.roymorgan.com/findings/alp-two-party-lead-is-smallest-since-the-federal-election-following-the-bondi-shooting-alp-52-cf-l-np-48" },
    src: "finding 9966", quote: "1,676 Australian electors from January 5-11, 2026. Of all electors surveyed, 4.5% (down 0.5%) can't say who they would vote for.",
    note: "url was the late-January release, which prints no can't-say share for this week" },
  { pollster: "Roy Morgan", date: "2026-01-18",
    set: { undecided: 4, url: "https://www.roymorgan.com/findings/9967-federal-voting-intention-january-18-2026" },
    src: "finding 9967", quote: "January 12-18, 2026. Of all electors surveyed, 4% (down 0.5%) can't say who they would vote for." },
  { pollster: "Roy Morgan", date: "2026-01-25", set: { sample: 1653 },
    src: "late-January release (.build/roymorgan-src)", quote: "a representative Australia-wide cross-section of 1,653 electors in the week of January 19-25, 2026",
    note: "was 1933, which the release never prints" },
  { pollster: "Roy Morgan", date: "2025-12-14", unset: ["undecided"],
    src: "finding 9956", quote: "4,862 Australian electors from November 17 – December 14, 2025. Of all electors surveyed, 5% (down 1%) can't say",
    note: "the 5% is the four-week sample's; this row holds the Dec 8–14 week (n 1,574), whose can't-say share is not printed" },
  { pollster: "Spectre Strategy", date: "2025-07-01", set: { tpp_undecided: { lnponp: 10 } },
    src: "https://www.spectrestrategy.com/blog-3-1/austalian-federal-polling-update-july-2025",
    quote: "The Labor Party leads the Liberal National Coalition 56.5% to 43.5% … 10% of voters were undecided before preferences were apportioned.",
    note: "lnponp is the legacy key for the Labor-v-Coalition contest; no One Nation contest that month" },
  { pollster: "Spectre Strategy", date: "2025-11-17", set: { tpp_undecided: { lnponp: 12.9 } },
    src: "https://www.spectrestrategy.com/blog-3-1/australian-federal-polling-update-november-2025",
    quote: "53% to 47% … 12.9% of voters were undecided before preferences were apportioned." },
  { pollster: "YouGov", date: "2026-03-19", set: { undecided: 8 },
    src: "https://cdn.australiainstitute.org.au/2026/03/18023552/Aus-Institute-Mar26-poll-summary-20032026-votingintention_GAS.pdf",
    quote: "Table 1 'If you had to vote tomorrow… how would you vote?': Don't know 8% (Total, n 1502)" },
];

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
let changed = 0;
for (const f of FILLS) {
  const row = D.polls.find((p) => p.pollster === f.pollster && p.date === f.date);
  if (!row) { console.log(`  MISSING ROW ${f.pollster} ${f.date}`); process.exitCode = 1; continue; }
  const diffs = [];
  for (const [k, v] of Object.entries(f.set || {})) {
    if (JSON.stringify(row[k]) !== JSON.stringify(v)) { diffs.push(`${k}: ${JSON.stringify(row[k])} → ${JSON.stringify(v)}`); row[k] = v; }
  }
  for (const k of f.unset || []) {
    if (k in row) { diffs.push(`${k}: ${JSON.stringify(row[k])} → (removed)`); delete row[k]; }
  }
  if (diffs.length) { changed++; console.log(`  ${f.pollster} ${f.date}: ${diffs.join("; ")}`); }
}
console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
console.log(`rows to change: ${changed}`);
if (APPLY && changed) writeAtomic("data/polls.json", JSON.stringify(D, null, 2) + "\n");
