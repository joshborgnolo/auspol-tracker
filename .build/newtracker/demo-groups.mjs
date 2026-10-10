/* demo-groups.mjs – the groups the Snapshot's vote-by-group panel pools
   across pollsters (gen-data §7g), and each house's own groups mapped onto
   them. Pure; pinned by .build/test-crosstabs.mjs.

   A house's group joins a common one only where it is the same people:
     gender      Men, Women – every house.
     age         18–34 – Resolve, DemosAU and YouGov all cut there. 35–54 and
                 55+ – Resolve and DemosAU. YouGov's 35–49 and 50+ (earlier
                 50–64 and 65+) hold other people, so they don't join.
     generation  Gen Z, Millennials, Gen X, Boomers – YouGov and RedBridge.
                 YouGov's Silent generation (RedBridge prints none) doesn't.
     education   three levels of highest qualification. DemosAU's School,
                 YouGov's Year 12 or less, and RedBridge's Below Year 12 and
                 Year 12 together are Year 12 or less; TAFE, TAFE or college
                 and TAFE or trade are TAFE or trade; University is University.
                 DemosAU (MRP)'s five-level scale shares only its TAFE row;
                 its Didn't Finish Grade 12 and Grade 12 pair and its
                 Undergraduate and Postgraduate pair are the common school
                 and university groups split in two, filed as printed.
                 RedBridge's two school rows merge 39:61, the split of its own
                 printed group sizes (Jul–Aug 2026: 216 and 343 respondents;
                 its earlier reports print none).
     state       NSW, Vic, Qld and ACT/NT/Tas/WA/SA – Resolve's four (its
                 fourth cut is filed "Rest of Australia"), every month of
                 the term. YouGov (Jun 2026 on) prints NSW, VIC and QLD,
                 then SA, WA and ACT/NT/TAS. SA and WA are common groups of
                 their own (YouGov and Roy Morgan both cut them); the three
                 together are ACT/NT/Tas/WA/SA, merged at their shares of the
                 2025 formal vote (AEC event 31496) – a known split, not an
                 estimate. A wave missing any of the three doesn't join
                 there. ACT/NT/Tas is a common group of its own, fed only by
                 cuts of exactly that trio: YouGov as printed (Jun 2026 on),
                 and DemosAU (MRP)'s Tas, ACT and NT rows merged at the
                 trio's own 2025 vote split (MRP_TRIO below) – again a known
                 split, not an estimate. Roy Morgan's Tas-alone cut and
                 EMRS (Tas)'s Tasmania-only polls are different people, so
                 the trio never pools them (gen-data carries them onto the
                 trio's view as solo display points instead). Roy Morgan
                 (from the 2026-09-27 wave's fortnight
                 release PDF) prints NSW, Vic, Qld, SA and WA, so it joins
                 at those five and never at ACT/NT/Tas or ACT/NT/Tas/WA/SA.
     location    Inner metro, Outer metro, Provincial and Rural – YouGov and
                 RedBridge cut identically. DemosAU's Regional/Rural is
                 provincial and rural voters together, so it joins only at
                 the two metro groups (as YouGov's age bands join only at
                 18–34). DemosAU (MRP)'s Reg & Rur is that same combined
                 cut, also filed as printed.
     housing     Own outright, Mortgage and Renting – YouGov and DemosAU.
                 RedBridge's Renting and other is wider than renters, so it
                 joins only at the two owner groups.
     language    English only and Other language at home – YouGov and
                 DemosAU.
     working     Full time, Part time and Retired – Newspoll (pooled)
                 prints the three rows quarterly (a not-working "Other"
                 residual besides); YouGov just the three, fortnightly
                 from Jun 2026. RedBridge's one demographic detail sheet
                 (Oct 2025) reads "Working full time" and "Working part
                 time" across the same first two. The residual –
                 Newspoll's Other, RedBridge's Not working – is one group
                 of people, but Newspoll is its only live printer, so it
                 joins nothing.

   Income is the ruled-out cut: the houses' brackets share no cut points
   (YouGov household <50k/50–99k/100–149k/150k+, binary under/over $100k
   since Apr 2026; DemosAU personal <$45k/$45–125k/$125k+; RedBridge
   weekly brackets; Freshwater $75–150k; Resolve and Morgan print none).
   Newspoll (pooled)'s four are YouGov's own four and merge pairwise onto
   its live binary line, but a merge needs printed group sizes, and
   neither of Newspoll's two quarterly tables PDFs (Q4-2025 and Q1-2026,
   checked 2026-10-10) prints income-bracket bases – state bases only –
   so the merge would be an estimate. Nothing here is reconcilable, so
   income joins no common group: the All-polls demographics facet
   contrasts each poll's own brackets instead (ruling of 2026-10-07,
   confirmed 2026-10-10). */

export const DEMO_TABS = [
  { id: "age", label: "Age" },
  { id: "gender", label: "Gender" },
  { id: "education", label: "Education" },
  { id: "place", label: "Place" },
  { id: "home", label: "Home" },
];
export const DEMO_SETS = [
  { tab: "age", id: "age", label: "By age", groups: ["18–34", "35–54", "55+"] },
  { tab: "age", id: "generation", label: "By generation", groups: ["Gen Z", "Millennials", "Gen X", "Boomers"] },
  { tab: "gender", id: "gender", label: null, groups: ["Men", "Women"] },
  { tab: "education", id: "education", label: null, groups: ["Year 12 or less", "TAFE or trade", "University"] },
  { tab: "place", id: "state", label: "By state", groups: ["NSW", "Vic", "Qld", "SA", "WA", "ACT/NT/Tas", "ACT/NT/Tas/WA/SA"] },
  { tab: "place", id: "location", label: "By location", groups: ["Inner metro", "Outer metro", "Provincial", "Rural"] },
  { tab: "home", id: "housing", label: "By housing", groups: ["Own outright", "Mortgage", "Renting"] },
  { tab: "home", id: "language", label: "By language at home", groups: ["English only", "Other language"] },
  { tab: "home", id: "working", label: "By work status", groups: ["Full time", "Part time", "Retired"] },
];

/* Rough shares of the adult population. They size each group's sampling-
   error floor – a group of a 1,500-person poll is about 1,500 × its share –
   and nothing else: every poll's group carries the same share, so it
   cancels out of the pooled figure. States: their shares of the 2025 formal
   vote. Location: RedBridge's own printed group sizes (Aug 2026: 280, 307,
   144 and 196 of 927), the same cut as YouGov's. Housing and language: the
   2021 census (dwellings owned outright 31%, with a mortgage 35%, rented
   31%; persons speaking only English at home 72%, another language 22%),
   each taken to 100. Work status: ABS Labour Force (March 2026 trend: 44%
   of the civilian population 15 and over in a full-time job, 20% in a
   part-time job) and Retirement and Retirement Intentions 2022-23 (4.2
   million retirees, 19% of 15+); the not-working-not-retired residual
   (~16%) joins no group. */
export const DEMO_SHARE = {
  Men: 0.49, Women: 0.51,
  "18–34": 0.28, "35–54": 0.33, "55+": 0.39,
  "Gen Z": 0.19, Millennials: 0.28, "Gen X": 0.25, Boomers: 0.28,
  "Year 12 or less": 0.40, "TAFE or trade": 0.31, University: 0.29,
  NSW: 0.31, Vic: 0.26, Qld: 0.20, SA: 0.07, WA: 0.10, "ACT/NT/Tas": 0.049, "ACT/NT/Tas/WA/SA": 0.23,
  "Inner metro": 0.30, "Outer metro": 0.33, Provincial: 0.16, Rural: 0.21,
  "Own outright": 0.32, Mortgage: 0.36, Renting: 0.32,
  "English only": 0.76, "Other language": 0.24,
  "Full time": 0.44, "Part time": 0.20, Retired: 0.19,
};

const KEYS = ["alp", "lnp", "onp", "grn", "oth"];
const RB_SCHOOL = [["Below Year 12", 0.39], ["Year 12", 0.61]];
/* YouGov's three smaller regions as shares of their combined 2025 formal
   vote (AEC event 31496: SA 7.3%, WA 10.3%, Tas, ACT and NT 4.9% of the
   national vote). */
const YG_REST = [["SA", 0.324], ["WA", 0.457], ["ACT/NT/Tas", 0.219]];
/* DemosAU (MRP)'s Tas, ACT and NT rows as shares of the trio's combined
   2025 formal vote (event 31496: Tas 367,259 votes, ACT 290,565, NT
   105,762). */
const MRP_TRIO = [["Tas", 0.481], ["ACT", 0.3805], ["NT", 0.1385]];

/* One wave's groups on the common sets:
   { gender: { Men: shares, … }, age: { "18–34": shares, … }, generation, education,
     state, location, housing, language, working }.
   A party that printed a zero (a segment that rounded to nothing) stays 0;
   a key ABSENT from the printed table stays null – RedBridge's July 2025
   AFR table folds One Nation into Others, and reading that fold as a zero
   share would pollute every One Nation pool the wave's groups join. */
export function harmonize(w) {
  const d = (w && w.dims) || {}, out = {};
  const put = (set, group, sh) => {
    if (sh) (out[set] ||= {})[group] = Object.fromEntries(KEYS.map((k) => [k, sh[k] == null ? null : (+sh[k] || 0)]));
  };
  for (const g of ["Men", "Women"]) put("gender", g, d.gender && d.gender[g]);
  // only the bands whose edges match join: YouGov's 35–49 and 50+ find no key here
  for (const g of ["18–34", "35–54", "55+"]) put("age", g, d.age && d.age[g]);
  for (const g of ["Gen Z", "Millennials", "Gen X", "Boomers"]) put("generation", g, d.generation && d.generation[g]);
  const e = d.education;
  if (e) {
    const school = RB_SCHOOL.every(([l]) => e[l])
      ? Object.fromEntries(KEYS.map((k) => [k, RB_SCHOOL.reduce((t, [l, wt]) => t + (+e[l][k] || 0) * wt, 0)]))
      : e["School"] || e["Year 12 or less"];
    put("education", "Year 12 or less", school);
    put("education", "TAFE or trade", e["TAFE"] || e["TAFE or college"] || e["TAFE or trade"]);
    put("education", "University", e["University"]);
  }
  const st = d.state;
  if (st) {
    for (const g of ["NSW", "Vic", "Qld", "SA", "WA"]) put("state", g, st[g]);
    /* the trio joins only from cuts of exactly that trio – a Tas-alone or
       ACT-alone row (Roy Morgan, EMRS) is never read into it */
    const trio = st["ACT/NT/Tas"] || (MRP_TRIO.every(([l]) => st[l])
      ? Object.fromEntries(KEYS.map((k) => [k, MRP_TRIO.reduce((t, [l, wt]) => t + (+st[l][k] || 0) * wt, 0)]))
      : null);
    put("state", "ACT/NT/Tas", trio);
    const rest = st["Rest of Australia"] || (YG_REST.every(([l]) => st[l])
      ? Object.fromEntries(KEYS.map((k) => [k, YG_REST.reduce((t, [l, wt]) => t + (+st[l][k] || 0) * wt, 0)]))
      : null);
    put("state", "ACT/NT/Tas/WA/SA", rest);
  }
  // DemosAU's Regional or rural finds no key here; RedBridge's Renting and other neither
  for (const g of ["Inner metro", "Outer metro", "Provincial", "Rural"]) put("location", g, d.location && d.location[g]);
  for (const g of ["Own outright", "Mortgage", "Renting"]) put("housing", g, d.housing && d.housing[g]);
  for (const g of ["English only", "Other language"]) put("language", g, d.language && d.language[g]);
  const wk = d.working;
  if (wk) {
    /* Newspoll's Other and RedBridge's Not working – the not-working,
       not-retired residual – find no key here: Newspoll is its only
       live printer */
    put("working", "Full time", wk["Full time"] || wk["Working full time"]);
    put("working", "Part time", wk["Part time"] || wk["Working part time"]);
    put("working", "Retired", wk.Retired);
  }
  return out;
}
