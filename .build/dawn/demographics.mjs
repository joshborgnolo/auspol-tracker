// The five November 2026 graphics and their accompanying plotting data use this party order.
const parties = ["Labor", "One Nation", "the Coalition", "the Greens"];
const charts = [
  { id: "generation", label: "Generation", subject: "Boomers", baseline: "Gen Z voters",
    groups: ["Gen Z", "Millennials", "Gen X", "Boomers"],
    headline: "Greens support ranges from 34% among Gen Z to 4% among Boomers",
    sources: "YouGov and RedBridge/Accent",
    halfWidths: [[2.9, 2.6, 2.7, 2.5], [2.7, 0.8, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0]],
    pairs: [[], [[0, 1], [1, 2], [1, 3]], [[0, 1], [1, 2], [2, 3]], [[0, 1], [1, 2], [2, 3]]],
    votes: [[28.8,28.1,25.7,26.6],[11.2,23.2,29.8,29.1],[15.2,20.8,25.3,31.4],[33.6,17,8.6,4]] },
  { id: "age", label: "Age group", subject: "voters aged 55+", baseline: "18–34-year-olds",
    groups: ["18–34", "35–54", "55+"],
    headline: "Voting intention varies markedly by age",
    sources: "YouGov, Essential, DemosAU and Resolve",
    halfWidths: [[2.4, 2.0, 2.0], [2.1, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]],
    pairs: [[[1, 2], [0, 2]], [[0, 1], [1, 2]], [[0, 1], [1, 2]], [[0, 1], [1, 2]]],
    votes: [[29.5,27.6,24.5],[15.7,25.7,30],[18.2,22.8,30.5],[26.8,12.8,5]] },
  { id: "education", label: "Education", subject: "university graduates", baseline: "voters without post-school education",
    groups: ["Year 12 or less", "TAFE or trade", "University"],
    headline: "One Nation support is lowest among university graduates",
    sources: "YouGov, DemosAU and RedBridge/Accent",
    halfWidths: [[2.5, 2.5, 2.6], [1.7, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]],
    pairs: [[[1, 2], [0, 2]], [[1, 2], [0, 2]], [[1, 2]], [[0, 1], [1, 2]]],
    votes: [[24.9,25.4,31],[28.2,28.8,15.7],[24.5,23,26.9],[13.6,11.4,15.7]] },
  { id: "seat-type", label: "Seat type", subject: "voters in rural seats", baseline: "inner metro voters",
    groups: ["Inner metro", "Outer metro", "Provincial", "Rural"],
    headline: "One Nation polls at 17% in inner metro seats and 31% in rural seats",
    sources: "YouGov, DemosAU and RedBridge/Accent",
    halfWidths: [[3.1, 2.8, 3.5, 2.9], [2.5, 1.9, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0]],
    pairs: [[[2, 3], [1, 3], [0, 3]], [[0, 1], [2, 3], [0, 2]], [[1, 3]], [[0, 1], [2, 3], [0, 2]]],
    votes: [[29,31.2,29.5,18.3],[17.1,24.6,26.5,31.4],[25.1,22.8,23.6,27.7],[18.3,12.4,13,9.2]] },
  { id: "language", label: "Language at home", subject: "those who speak another language", baseline: "voters who speak only English at home",
    groups: ["English only", "Other language"],
    headline: "Labor polls higher among voters who speak another language at home",
    sources: "YouGov and DemosAU",
    halfWidths: [[2.4, 2.7], [1.6, 0.0], [0.0, 0.0], [0.0, 0.0]],
    pairs: [[[0, 1]], [[0, 1]], [], [[0, 1]]],
    votes: [[25.7,32.6],[26.2,16.5],[24.8,24.7],[13.1,16.7]] },
];

// Both bars start at zero. Keep the same scale when switching comparisons.
const scaleMax = Math.ceil(Math.max(...charts.flatMap(chart => chart.votes.flat())) / 10) * 10;
const partyKeys = ["alp", "onp", "lnp", "grn"];

function finding({ id, groups, subject, baseline, votes }, index) {
  const differences = votes.map((shares, i) => ({
    party: parties[i], key: partyKeys[i], first: shares[0], last: shares.at(-1),
    gap: shares.at(-1) - shares[0], ratio: shares.at(-1) / shares[0],
  })).sort((a, b) => b.gap - a.gap);
  const high = differences[0], low = differences.at(-1);
  const likelihood = p => p.ratio >= 2 ? `${p.ratio.toFixed(1)} times as likely`
    : `${Math.round(Math.abs(p.ratio - 1) * 100)}% ${p.gap > 0 ? "more" : "less"} likely`;
  const rows = differences.toSorted((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).map(p => {
    const bars = [p.first, p.last].map((value, i) =>
      `<span class="bar-line"><i class="bar ${i ? 'solid' : 'hatched'}" style="width:${100 * value / scaleMax}%"></i><b>${value.toFixed(1)}%</b></span>`
    ).join("");
    const label = p.party.replace(/^the /, "");
    return `<div class="party-row ${p.key}" role="img" aria-label="${label}. ${groups[0]}: ${p.first}%. ${groups.at(-1)}: ${p.last}%."><span class="party-label">${label}</span><span class="bar-pair">${bars}</span></div>`;
  }).join("");
  return `<div id="finding-${id}" class="finding"${index ? " hidden" : ""}>
    <div class="bar-key"><span><i class="hatched"></i>${groups[0]}</span><span><i class="solid"></i>${groups.at(-1)}</span></div>
    <div class="party-plot">${rows}</div>
    <div class="takeaway">
      <p class="takeaway-context">Compared with ${baseline}, ${subject} are</p>
      <ul>${[high, low].map(p => `<li><strong>${likelihood(p)}</strong> to back <span class="party-name ${p.key}">${p.party}</span></li>`).join("")}</ul>
    </div>
  </div>`;
}

function panel({ id, label, groups, votes, halfWidths, pairs, headline, sources }) {
  const plots = votes.map((shares, partyIndex) => {
    const name = parties[partyIndex].replace(/^the /, "");
    const rows = shares.map((value, i) => {
      const half = halfWidths[partyIndex][i];
      const interval = `${(value - half).toFixed(1)}–${(value + half).toFixed(1)}%`;
      return `<div class="demo-row" title="${groups[i]} · ${value}% (95% interval ${interval})">
        <span>${groups[i]}</span><span class="demo-track" aria-hidden="true">
          <i class="demo-fill" style="width:${100 * value / scaleMax}%"></i>
          <i class="demo-interval" style="left:${100 * (value - half) / scaleMax}%;width:${200 * half / scaleMax}%"></i>
        </span><b>${value.toFixed(1)}%</b><span class="sr">Approximate 95% credible interval ${interval}</span>
      </div>`;
    }).join("");
    const arcs = pairs[partyIndex].map(([from, to]) =>
      `<i class="demo-arc" style="--start:${from};--span:${to - from}" title="${groups[from]} and ${groups[to]}"><span class="sr">${name}: ${groups[from]} and ${groups[to]} have a credible difference.</span></i>`
    ).join("");
    return `<section class="demo-party" style="--party:var(--${["alp","on","lnp","grn"][partyIndex]})">
      <h3>${name}</h3><div class="demo-series">${arcs}${rows}</div></section>`;
  }).join("");
  const table = groups.map((g, i) => `<tr><th scope="row">${g}</th>${votes.map(v => `<td>${v[i]}%</td>`).join("")}</tr>`).join("");
  return `<section id="${id}" class="sec chart-panel" aria-labelledby="heading-${id}">
    <i class="snap" aria-hidden="true"></i><div class="wrap">
    <header class="hd"><h2 id="heading-${id}">${label}</h2><p class="dek">${headline}</p></header>
    <div class="demo-plots">${plots}</div>
    <p class="src">Estimated first preferences, November 2026. Whiskers show approximate 95% credible intervals. Brackets connect selected groups whose 95% interval for the difference excludes zero.</p>
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
