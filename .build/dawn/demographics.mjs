// The November 2026 graphics and their accompanying plotting data use this party order.
const parties = ["Labor", "One Nation", "the Coalition", "the Greens"];
const charts = [
  { id: "generation", label: "Generation", subject: "Boomers", baseline: "Gen Z voters",
    groups: ["Gen Z", "Millennials", "Gen X", "Boomers"],
    headline: "Labor is the only party with even intergenerational appeal",
    sources: "YouGov and RedBridge/Accent",
    halfWidths: [[2.9, 2.7, 2.6, 2.6], [1.9, 2.6, 2.7, 2.6], [2.2, 2.5, 2.7, 3.1], [2.7, 2.1, 1.3, 0.8]],
    pairs: [[], [[0, 1], [1, 2], [1, 3]], [[0, 1], [1, 2], [2, 3]], [[0, 1], [1, 2], [2, 3]]],
    votes: [[28.8,28.1,25.7,26.6],[11.2,23.2,29.8,29.1],[15.2,20.8,25.3,31.4],[33.6,17,8.6,4]] },
  { id: "age", label: "Age group", subject: "voters aged 55+", baseline: "18–34-year-olds",
    groups: ["18–34", "35–54", "55+"],
    headline: "Voting intention varies markedly by age",
    sources: "YouGov, Essential, DemosAU and Resolve",
    halfWidths: [[2.4, 2.2, 2.0], [2.0, 2.4, 2.4], [2.0, 2.3, 2.6], [2.1, 1.4, 0.7]],
    pairs: [[[1, 2], [0, 2]], [[0, 1], [1, 2]], [[0, 1], [1, 2]], [[0, 1], [1, 2]]],
    votes: [[29.5,27.6,24.5],[15.7,25.7,30],[18.2,22.8,30.5],[26.8,12.8,5]] },
  { id: "education", label: "Education", subject: "university graduates", baseline: "voters without post-school education",
    groups: ["Year 12 or less", "TAFE or trade", "University"],
    headline: "One Nation support is lowest among university graduates",
    sources: "YouGov, DemosAU and RedBridge/Accent",
    halfWidths: [[2.5, 2.5, 2.8], [2.5, 2.7, 2.0], [2.6, 2.5, 2.7], [1.7, 1.5, 1.8]],
    pairs: [[[1, 2], [0, 2]], [[1, 2], [0, 2]], [[1, 2]], [[0, 1], [1, 2]]],
    votes: [[24.9,25.4,31],[28.2,28.8,15.7],[24.5,23,26.9],[13.6,11.4,15.7]] },
  { id: "seat-type", label: "Seat type", subject: "voters in rural seats", baseline: "inner metro voters",
    groups: ["Inner metro", "Outer metro", "Provincial", "Rural"],
    headline: "One Nation polls at 17% in inner metro seats and 31% in rural seats",
    sources: "YouGov, DemosAU and RedBridge/Accent",
    halfWidths: [[3.1, 3.2, 3.8, 2.8], [2.8, 3.1, 3.5, 4.0], [3.1, 2.9, 3.4, 3.7], [2.5, 2.0, 2.5, 1.9]],
    pairs: [[[2, 3], [1, 3], [0, 3]], [[0, 1], [2, 3], [0, 2]], [[1, 3]], [[0, 1], [2, 3], [0, 2]]],
    votes: [[29,31.2,29.5,18.3],[17.1,24.6,26.5,31.4],[25.1,22.8,23.6,27.7],[18.3,12.4,13,9.2]] },
  { id: "language", label: "Language at home", subject: "those who speak another language", baseline: "voters who speak only English at home",
    groups: ["English only", "Other language"],
    headline: "Labor polls higher among voters who speak another language at home",
    sources: "YouGov and DemosAU",
    halfWidths: [[2.4, 3.5], [2.5, 2.7], [2.5, 3.4], [1.6, 2.3]],
    pairs: [[[0, 1]], [[0, 1]], [], [[0, 1]]],
    votes: [[25.7,32.6],[26.2,16.5],[24.8,24.7],[13.1,16.7]] },
  { id: "state-territory", label: "State/territory", subject: "Queenslanders", baseline: "voters in the combined ACT, NT and Tasmania group",
    groups: ["NSW", "Vic", "Qld", "SA", "WA", "ACT/NT/Tas"], comparison: [5, 2],
    headline: "One Nation polls highest in Queensland",
    sources: "YouGov, Resolve and Roy Morgan",
    halfWidths: [[2.5,2.4,2.5,3.6,3.1,6.1],[2.7,2.6,2.9,3,3,3.8],[2.5,2.9,2.6,3.1,3.1,4.8],[1.5,1.8,1.8,2.5,2.1,3.6]],
    pairs: [[[0,1],[2,3],[0,2],[2,4],[2,5]],[[1,2],[2,3],[3,4],[4,5],[0,2]],[[0,1],[1,2],[1,3],[1,4],[1,5]],[[0,1],[2,3],[0,3]]],
    votes: [[28.4,24.2,24.1,31.4,27.9,32.3],[24.3,22.9,30.2,20.9,25.2,18.1],[23,29.5,23.8,22.5,24.8,20.4],[11.4,14.6,12.5,16.1,13.6,13.5]] },
];

const demographicOrder = ["generation", "age", "education", "state-territory", "seat-type", "language"];
charts.sort((a, b) => demographicOrder.indexOf(a.id) - demographicOrder.indexOf(b.id));

// Both bars start at zero. Keep the same scale when switching comparisons.
const scaleMax = Math.ceil(Math.max(...charts.flatMap(chart => chart.votes.flat())) / 10) * 10;
const partyKeys = ["alp", "onp", "lnp", "grn"];
const partyShortNames = { alp: "ALP", onp: "ON", lnp: "L/NP", grn: "GRN" };

function finding({ id, groups, subject, baseline, votes, comparison = [0, groups.length - 1] }, index) {
  const [base, target] = comparison;
  const differences = votes.map((shares, i) => ({
    party: parties[i], key: partyKeys[i], first: shares[base], last: shares[target],
    gap: shares[target] - shares[base], ratio: shares[target] / shares[base],
  })).sort((a, b) => b.gap - a.gap);
  const high = differences[0], low = differences.at(-1);
  const likelihood = p => p.ratio >= 2 ? `${p.ratio.toFixed(1)}× as likely`
    : `${Math.round(Math.abs(p.ratio - 1) * 100)}% ${p.gap > 0 ? "more" : "less"} likely`;
  const rows = differences.toSorted((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).map(p => {
    const bars = [p.first, p.last].map((value, i) =>
      `<span class="bar-line"><i class="bar ${i ? 'solid' : 'hatched'}" style="width:${100 * value / scaleMax}%"></i><b>${value.toFixed(1)}%</b></span>`
    ).join("");
    const label = p.party.replace(/^the /, "");
    return `<div class="party-row ${p.key}" role="img" aria-label="${label}. ${groups[base]}: ${p.first}%. ${groups[target]}: ${p.last}%."><span class="party-label">${label}</span><span class="bar-pair">${bars}</span></div>`;
  }).join("");
  return `<div id="finding-${id}" class="finding"${index ? " hidden" : ""}>
    <div class="bar-key"><span><i class="hatched"></i>${groups[base]}</span><span><i class="solid"></i>${groups[target]}</span></div>
    <div class="party-plot">${rows}</div>
    <div class="takeaway">
      <p class="takeaway-context">Compared with ${baseline}, ${subject} are</p>
      <ul>${[high, low].map(p => `<li><strong>${likelihood(p)}</strong> to back <span class="party-name ${p.key}">${partyShortNames[p.key]}</span></li>`).join("")}</ul>
    </div>
  </div>`;
}

function panel({ id, label, groups, votes, halfWidths, pairs, headline, sources }) {
  // Coordinates in the original ggplot panels, relative to each party heading.
  const colours = ["#f34c59", "#f88c35", "#258fda", "#30aa72"];
  const axis = 237, track = 458, step = 61;
  const scale = value => value * track / 65;
  const plots = votes.map((shares, partyIndex) => {
    const name = parties[partyIndex].replace(/^the /, "");
    const colour = colours[partyIndex];
    const bottom = 101 + (groups.length - 1) * step;
    const ticks = Array.from({length: 7}, (_, i) => {
      const x = axis + scale(10 * i);
      return `<text x="${x}" y="21" text-anchor="middle">${10 * i}</text><path d="M${x} 33V${bottom}" stroke="#53473f" stroke-opacity=".24" stroke-width="1.5"/>`;
    }).join("");
    const backgrounds = [], bars = [];
    shares.forEach((value, i) => {
      const y = 49 + step * i, mid = y + 21;
      const half = halfWidths[partyIndex][i];
      const low = axis + scale(value - half), high = axis + scale(value + half);
      const rect = (width, fill) => `<rect x="${axis}" y="${y}" width="${width}" height="42" fill="${fill}"/><path d="M${axis+width} ${y}H${axis}v42h${width}" fill="none" stroke="#69625f" stroke-width="1.5"/>`;
      backgrounds.push(rect(track, "#e9dcd2"));
      bars.push(`<g><title>${groups[i]} · ${value}% (95% interval ${(value-half).toFixed(1)}–${(value+half).toFixed(1)}%)</title>
        <text x="43" y="${mid+10}">${groups[i]}</text>${rect(scale(value), colour)}
        <path class="gg-whisker" d="M${low} ${mid}H${high}M${low} ${mid-5}v10M${high} ${mid-5}v10" stroke="#352e2b" stroke-width="2"/></g>`);
    });
    const arcs = pairs[partyIndex].map(([from, to]) => {
      const distance = to - from;
      return `<path d="M35 ${70+step*from}a${12+8*(distance-1)} ${step*distance/2} 0 0 0 0 ${distance*step}" fill="none" stroke="${colour}" stroke-width="2.8"><title>${groups[from]} and ${groups[to]}</title></path>`;
    }).join("");
    return `<svg class="gg-party" viewBox="-20 -12 736 ${bottom+42}" role="img" aria-label="${name} first preferences by ${label.toLowerCase()}"><text class="gg-name" x="0" y="23">${name}</text>${backgrounds.join("")}${ticks}${bars.join("")}${arcs}</svg>`;
  }).join("");
  const table = groups.map((g, i) => `<tr><th scope="row">${g}</th>${votes.map(v => `<td>${v[i]}%</td>`).join("")}</tr>`).join("");
  return `<section id="${id}" class="sec chart-panel" aria-labelledby="heading-${id}">
    <i class="snap" aria-hidden="true"></i><div class="wrap">
    <header class="hd"><h2 id="heading-${id}">${label}</h2><p class="dek">${headline}</p></header>
    <div class="gg-plots">${plots}</div>
    <p class="src">Estimated first preferences, November 2026. Whiskers show approximate 95% credible intervals. Curves connect selected groups whose 95% interval for the difference excludes zero.</p>
    <p class="src">AusPol Tracker estimates from ${sources}, 24 November 2026.</p>
    <details><summary>View vote shares</summary><table><caption class="sr">Estimated first preferences by ${label.toLowerCase()}, November 2026</caption>
    <thead><tr><th scope="col">${label}</th>${["Labor","One Nation","Coalition","Greens"].map(p => `<th scope="col">${p}</th>`).join("")}</tr></thead>
    <tbody>${table}</tbody></table></details>
    </div></section>`;
}

export const demographicsMarkup = {
  buttons: () => charts.map(({id, label}, i) => `<button type="button" aria-pressed="${i === 0}" aria-controls="finding-${id}">${label}</button>`).join(""),
  findings: () => charts.map(finding).join("\n"),
  panels: () => charts.map(panel).join("\n"),
};

// Use the main site's published passes. Its Holm test uses unrounded probabilities.
export function shiftsMarkup({ demoGaps, demoTrend }) {
  const facets = { age: "Age group", generation: "Generation", gender: "Gender", education: "Education",
    state: "State/territory", location: "Seat type", housing: "Housing tenure", language: "Language at home",
    working: "Employment", income: "Income" };
  const names = { alp: "Labor", lnp: "Coalition", onp: "One Nation", grn: "Greens", oth: "Others" };
  const month = ym => new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(ym + "-01T00:00:00Z"));
  const sections = Object.entries(demoGaps || {}).filter(([, family]) => family.pass.length).map(([id, family]) => {
    const rows = family.pass.toSorted((x, y) => Math.abs(y.lr) - Math.abs(x.lr)).map(r => {
      const period = r.model ? demoTrend[r.party].rows.find(row => row.set === id && row.group === r.a) : r;
      const change = Math.round(100 * Math.expm1(r.lr));
      return `<tr><td>${r.a} / ${r.b}<small>${names[r.party]} · ${month(period.from)}–${month(period.to)}</small></td>
        <td>${r.r0.toFixed(2)}×</td><td>${r.r1.toFixed(2)}×</td><td>${change > 0 ? "+" : "−"}${Math.abs(change)}%</td></tr>`;
    }).join("");
    return `<tbody><tr><th class="facet-name" colspan="4" scope="rowgroup">${facets[id] || id}</th></tr>${rows}</tbody>`;
  }).join("");
  return `<section id="demographic-shifts" class="sec shifts" aria-labelledby="shifts-heading">
    <i class="snap" aria-hidden="true"></i><div class="wrap"><header class="hd"><h2 id="shifts-heading">Demographic shifts</h2>
    <p class="dek">Where support for a party has shifted between two groups. Each ratio divides the first group’s vote share by the second’s. At 1×, the two groups back the party equally.</p></header>
    ${sections ? `<table aria-labelledby="shifts-heading"><thead><tr><th scope="col">Groups and party</th><th scope="col">Start</th><th scope="col">End</th><th scope="col">Change</th></tr></thead>${sections}</table>` :
      `<p>${demoGaps ? "No shifts passed the significance test." : "Shift estimates are unavailable."}</p>`}
    <p class="src">Change is the percentage change in relative support. Only shifts passing the main site’s 5% Holm-adjusted test across all parties and group pairs within each demographic are shown.</p>
    </div></section>`;
}
