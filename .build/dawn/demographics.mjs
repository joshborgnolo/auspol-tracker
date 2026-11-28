// The five November 2026 graphics and their accompanying plotting data use this party order.
const parties = ["Labor", "One Nation", "the Coalition", "the Greens"];
const charts = [
  { id: "generation", label: "Generation", subject: "Boomers", baseline: "Gen Z voters",
    groups: ["Gen Z", "Millennials", "Gen X", "Boomers"],
    votes: [[28.8,28.1,25.7,26.6],[11.2,23.2,29.8,29.1],[15.2,20.8,25.3,31.4],[33.6,17,8.6,4]] },
  { id: "age", label: "Age group", subject: "Voters aged 55 and over", baseline: "18–34-year-olds",
    groups: ["18–34", "35–54", "55+"],
    votes: [[29.5,27.6,24.5],[15.7,25.7,30],[18.2,22.8,30.5],[26.8,12.8,5]] },
  { id: "education", label: "Education", subject: "University graduates", baseline: "voters with Year 12 or less",
    groups: ["Year 12 or less", "TAFE or trade", "University"],
    votes: [[24.9,25.4,31],[28.2,28.8,15.7],[24.5,23,26.9],[13.6,11.4,15.7]] },
  { id: "seat-type", label: "Seat type", subject: "Voters in rural seats", baseline: "those in inner metro seats",
    groups: ["Inner metro", "Outer metro", "Provincial", "Rural"],
    votes: [[29,31.2,29.5,18.3],[17.1,24.6,26.5,31.4],[25.1,22.8,23.6,27.7],[18.3,12.4,13,9.2]] },
  { id: "language", label: "Language at home", subject: "Voters who speak another language at home", baseline: "those who speak only English",
    groups: ["English only", "Other language"],
    votes: [[25.7,32.6],[26.2,16.5],[24.8,24.7],[13.1,16.7]] },
];

function finding({ id, subject, baseline, votes }, index) {
  const differences = votes.map((shares, i) => ({
    party: parties[i], gap: shares.at(-1) - shares[0], ratio: shares.at(-1) / shares[0],
  })).sort((a, b) => b.gap - a.gap);
  const high = differences[0], low = differences.at(-1);
  return `<p id="finding-${id}" class="finding"${index ? " hidden" : ""}>${subject} are <strong>${high.ratio.toFixed(1)} times</strong> as likely as ${baseline} to back ${high.party}, but only <strong>${low.ratio.toFixed(2)} times</strong> as likely to back ${low.party}.</p>`;
}

function panel({ id, label, groups, votes }) {
  const rows = groups.map((g, i) => `<tr><th scope="row">${g}</th>${votes.map(v => `<td>${v[i]}%</td>`).join("")}</tr>`).join("");
  const file = `charts/${id}-vote.svg`;
  // On a phone, stack the four party plots at a readable scale using windows onto the original SVG.
  const rowHeight = 196 + 61 * (groups.length - 2);
  const mobilePlots = parties.map((_, index) => {
    const x = index % 2 ? 738 : 22;
    const y = index < 2 ? 200 : 200 + rowHeight;
    return `<svg aria-hidden="true" viewBox="${x} ${y} 716 ${rowHeight - 12}"><image href="${file}" width="1488" height="${685 + 122 * (groups.length - 2)}"/></svg>`;
  }).join("");
  return `<section id="${id}" class="sec chart-panel" aria-labelledby="heading-${id}">
  <i class="snap" aria-hidden="true"></i>
  <div class="wrap"><header class="hd"><h2 id="heading-${id}">${label}</h2></header>
    <a class="chart-link" href="${file}" aria-label="Open full-size chart of first preferences by ${label.toLowerCase()}"><img src="${file}" alt="November 2026 first preferences by ${label.toLowerCase()}, with approximate 95% credible intervals."><span class="mobile-plots">${mobilePlots}</span></a>
    <p class="chart-note">Estimated first preferences, November 2026. Whiskers show approximate 95% credible intervals.</p>
    <details><summary>View vote shares</summary><table><caption class="sr">Estimated first preferences by ${label.toLowerCase()}, November 2026</caption>
    <thead><tr><th scope="col">${label}</th>${["Labor","One Nation","Coalition","Greens"].map(p => `<th scope="col">${p}</th>`).join("")}</tr></thead>
    <tbody>${rows}</tbody></table></details>
  </div></section>`;
}

export const demographicsMarkup = {
  buttons: () => charts.map(({id, label}, i) => `<button type="button" aria-pressed="${i === 0}" aria-controls="finding-${id}">${label}</button>`).join(""),
  findings: () => charts.map(finding).join("\n"),
  panels: () => charts.map(panel).join("\n"),
};
