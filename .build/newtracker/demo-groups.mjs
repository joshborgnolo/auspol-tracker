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
     state       NSW, Vic, Qld and Non-NSW/Vic/Qld – Resolve's four (its
                 fourth cut is filed "Rest of Australia"), every month of
                 the term. YouGov (Jun 2026 on) prints NSW, VIC and QLD,
                 then SA, WA and ACT/NT/TAS. SA and WA are common groups of
                 their own (YouGov and Roy Morgan both cut them); the three
                 together are Non-NSW/Vic/Qld, merged at their shares of the
                 2025 formal vote (AEC event 31496) – a known split, not an
                 estimate. A wave missing any of the three doesn't join
                 there. DemosAU (MRP) prints Tas, NT and ACT as their own
                 rows, which are none of the common groups, so it joins at
                 NSW, Vic, Qld, SA and WA alone. Roy Morgan (from the
                 2026-09-27 wave's fortnight
                 release PDF) prints NSW, Vic, Qld, SA and WA but no
                 Tas/ACT/NT cut, so it joins at the three big states and at
                 SA and WA, never at Non-NSW/Vic/Qld.
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

   Income is the ruled-out cut: YouGov's brackets (household income;
   <50k/50–99k/100–149k/150k+, earlier just under/over $100k) share no cut
   point with DemosAU's (personal income; <$45k/$45–125k/$125k+), and
   Resolve, RedBridge and Morgan print none. Nothing here is reconcilable
   without an estimate, so income joins no common group – the All-polls
   demographics facet contrasts each poll's own brackets instead (the "same
   people" rule above applied, 2026-10-07). */

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
  { tab: "place", id: "state", label: "By state", groups: ["NSW", "Vic", "Qld", "SA", "WA", "Non-NSW/Vic/Qld"] },
  { tab: "place", id: "location", label: "By location", groups: ["Inner metro", "Outer metro", "Provincial", "Rural"] },
  { tab: "home", id: "housing", label: "By housing", groups: ["Own outright", "Mortgage", "Renting"] },
  { tab: "home", id: "language", label: "By language at home", groups: ["English only", "Other language"] },
];

/* Rough shares of the adult population. They size each group's sampling-
   error floor – a group of a 1,500-person poll is about 1,500 × its share –
   and nothing else: every poll's group carries the same share, so it
   cancels out of the pooled figure. States: their shares of the 2025 formal
   vote. Location: RedBridge's own printed group sizes (Aug 2026: 280, 307,
   144 and 196 of 927), the same cut as YouGov's. Housing and language: the
   2021 census (dwellings owned outright 31%, with a mortgage 35%, rented
   31%; persons speaking only English at home 72%, another language 22%),
   each taken to 100. */
export const DEMO_SHARE = {
  Men: 0.49, Women: 0.51,
  "18–34": 0.28, "35–54": 0.33, "55+": 0.39,
  "Gen Z": 0.19, Millennials: 0.28, "Gen X": 0.25, Boomers: 0.28,
  "Year 12 or less": 0.40, "TAFE or trade": 0.31, University: 0.29,
  NSW: 0.31, Vic: 0.26, Qld: 0.20, SA: 0.07, WA: 0.10, "Non-NSW/Vic/Qld": 0.23,
  "Inner metro": 0.30, "Outer metro": 0.33, Provincial: 0.16, Rural: 0.21,
  "Own outright": 0.32, Mortgage: 0.36, Renting: 0.32,
  "English only": 0.76, "Other language": 0.24,
};

const KEYS = ["alp", "lnp", "onp", "grn", "oth"];
const RB_SCHOOL = [["Below Year 12", 0.39], ["Year 12", 0.61]];
/* YouGov's three smaller regions as shares of their combined 2025 formal
   vote (AEC event 31496: SA 7.3%, WA 10.3%, Tas, ACT and NT 4.9% of the
   national vote). */
const YG_REST = [["SA", 0.324], ["WA", 0.457], ["ACT/NT/Tas", 0.219]];

/* One wave's groups on the common sets:
   { gender: { Men: shares, … }, age: { "18–34": shares, … }, generation, education,
     state, location, housing, language }.
   A party a house left off a group (a segment that rounded to nothing) is 0. */
export function harmonize(w) {
  const d = (w && w.dims) || {}, out = {};
  const put = (set, group, sh) => {
    if (sh) (out[set] ||= {})[group] = Object.fromEntries(KEYS.map((k) => [k, +sh[k] || 0]));
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
    const rest = st["Rest of Australia"] || (YG_REST.every(([l]) => st[l])
      ? Object.fromEntries(KEYS.map((k) => [k, YG_REST.reduce((t, [l, wt]) => t + (+st[l][k] || 0) * wt, 0)]))
      : null);
    put("state", "Non-NSW/Vic/Qld", rest);
  }
  // DemosAU's Regional or rural finds no key here; RedBridge's Renting and other neither
  for (const g of ["Inner metro", "Outer metro", "Provincial", "Rural"]) put("location", g, d.location && d.location[g]);
  for (const g of ["Own outright", "Mortgage", "Renting"]) put("housing", g, d.housing && d.housing[g]);
  for (const g of ["English only", "Other language"]) put("language", g, d.language && d.language[g]);
  return out;
}
