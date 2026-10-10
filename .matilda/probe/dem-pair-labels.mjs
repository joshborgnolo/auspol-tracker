// dem-pair-labels — audit: every demographics wave whose dim SHOULD admit it
// to an All-polls Demographics split must satisfy demPairOf's exact-label pair
// (the "<$50k" vs "Under $50k" Newspoll class, fixed fc3e93f/f86c902).
// MISS = dim present, no pair matches. NEAR = matches after normalisation.
import fs from "fs";
const waves = JSON.parse(fs.readFileSync("data/demographics.json", "utf8")).waves;
const SPLITS = [
  { id: "age",       pairs: [["18–34","55+"],["Gen Z","Boomers"],["18–34","65+"],["18–34","50+"]], dims: ["age","generation"] },
  { id: "gender",    pairs: [["Women","Men"]], dims: ["gender","sex"] },
  { id: "education", pairs: [["University","School"],["University","Year 12 or less"],["University","No tertiary"],["University","High School"]], dims: ["education"] },
  { id: "place",     pairs: [["Inner metro","Rural"],["Inner metro","Regional or rural"],["Capital Cities","Regional/Rural Areas"]], dims: ["place","location","state","region","citycountry"] },
  { id: "home",      pairs: [["Renting","Own outright"],["Renting and other","Own outright"]], dims: ["home","housing","tenure","rent"] },
  { id: "income",    pairs: [["$150k+","Under $50k"],["$125k+","Under $45k"],["$100k or more","Under $100k"]], dims: ["income","salary","wages"] },
  { id: "country",   pairs: [["Vietnam","Australia"],["Mainland China","Australia"],["South Africa","Australia"],["United Kingdom","Australia"]], dims: ["country","birth","born"] },
];
const norm = (s) => s.toLowerCase().replace(/[–—−]/g, "-").replace(/\s+/g, " ").trim();
let nMiss = 0, nNear = 0;
for (const sp of SPLITS) {
  for (const w of waves) {
    const keys = Object.keys(w.dims || {});
    if (!keys.some((k) => sp.dims.includes(k))) continue;
    const labels = new Set();
    for (const k of keys) for (const lab of Object.keys(w.dims[k] || {})) labels.add(lab);
    const nl = new Map([...labels].map((l) => [norm(l), l]));
    if (!sp.pairs.some(([a, b]) => labels.has(a) && labels.has(b))) {
      nMiss++;
      const near = sp.pairs.filter(([a, b]) => nl.has(norm(a)) && nl.has(norm(b)));
      if (near.length) nNear++;
      console.log(`${near.length ? "NEAR" : "MISS"} ${sp.id.padEnd(9)} ${w.pollster.padEnd(20)} ${w.date}`);
      for (const k of keys) if (sp.dims.includes(k)) console.log(`      ${k}: ${Object.keys(w.dims[k]).join(" | ")}`);
    }
  }
}
console.log(`\n${nMiss} wave-split misses (${nNear} normalisable) over ${waves.length} waves`);
