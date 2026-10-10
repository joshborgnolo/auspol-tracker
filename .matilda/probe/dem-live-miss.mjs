// dem-live-miss — LIVE admission audit: replicate demGroupsOf (grp.d labels +
// canonical demoGroups filled from grp.v) over the built individualPolls, so
// misses reported are what the facet really excludes, catching the class
// fixed in f86c902 (Newspoll "<$50k" vs "Under $50k").
import fs from "fs";
const src = fs.readFileSync(".build/newtracker/assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js", "utf8");
/* the bundle assigns window.AUSPOL itself; capture the window, then read
   ITS property (passing {AUSPOL} left the outer const {}, a vacuous pass) */
const w = {};
new Function("window", src)(w);
const D = w.AUSPOL || {};
const SPLITS = [
  { id: "age",       pairs: [["18–34","55+"],["Gen Z","Boomers"],["18–34","65+"],["18–34","50+"]] },
  { id: "gender",    pairs: [["Women","Men"]] },
  { id: "education", pairs: [["University","School"],["University","Year 12 or less"],["University","No tertiary"],["University","High School"]] },
  { id: "place",     pairs: [["Inner metro","Rural"],["Inner metro","Regional or rural"],["Capital Cities","Regional/Rural Areas"]] },
  { id: "home",      pairs: [["Renting","Own outright"],["Renting and other","Own outright"]] },
  { id: "income",    pairs: [["$150k+","Under $50k"],["$125k+","Under $45k"],["$100k or more","Under $100k"]] },
  { id: "country",   pairs: [["Vietnam","Australia"],["Mainland China","Australia"],["South Africa","Australia"],["United Kingdom","Australia"]] },
];
const G = D.demoGroups || [];
function groupsOf(p) {
  const g = p && p.grp;
  if (!g) return null;
  const m = {};
  for (const rows of Object.values(g.d || {})) for (const [lab, v] of rows) m[lab] = v;
  (g.v || []).forEach((v, i) => { if (v && !m[G[i]]) m[G[i]] = v; });
  return m;
}
let n = 0;
for (const sp of SPLITS) {
  const rows = [];
  for (const p of D.individualPolls || []) {
    const m = groupsOf(p);
    if (!m) continue;
    const anyPairLabel = sp.pairs.some(([a, b]) => a in m || b in m);
    // a wave "has" the split's dim if the printed dims include a label that's
    // a pair endpoint on ANY house's spelling — else it's legitimately absent
    if (!anyPairLabel && !Object.values(p.grp.d || {}).flatMap((r) => r.map((x) => x[0])).some((l) => sp.pairs.some(([a, b]) => l === a || l === b))) continue;
    if (!sp.pairs.some(([a, b]) => m[a] != null && m[b] != null)) rows.push(`${p.pollster} ${p.date}  [${Object.keys(m).join(" | ")}]`);
  }
  if (rows.length) { console.log(`-- ${sp.id}: ${rows.length} live misses`); rows.forEach((r) => console.log("   " + r)); n += rows.length; }
}
console.log(n ? `${n} live wave-split exclusions` : "no live facet-admission failures");
