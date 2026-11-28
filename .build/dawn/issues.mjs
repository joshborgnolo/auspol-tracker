// All shares and intervals are the main site's fitted estimates.
const parties = { alp: "Labor", lnp: "Coalition", onp: "One Nation" };
const month = ym => new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(ym + "-01T00:00:00Z"));
const pct = n => Number(n.toFixed(1)) + "%";

function bar(label, value, low, high, colour) {
  const interval = Number.isFinite(low) && Number.isFinite(high);
  return `<div class="issue-row" title="${label}: ${pct(value)}${interval ? `, 95% credible interval ${pct(low)}–${pct(high)}` : ""}">
    <span>${label}</span><span class="issue-track" aria-hidden="true"><i style="width:${value}%;background:${colour}"></i>
    ${interval ? `<b style="left:${low}%;width:${high-low}%"></b>` : ""}</span><strong>${pct(value)}</strong>
    ${interval ? `<span class="sr">95% credible interval ${pct(low)} to ${pct(high)}</span>` : ""}</div>`;
}

function trend(rows) {
  const first = rows[0][0], last = rows.at(-1)[0];
  const index = ym => Number(ym.slice(0,4))*12 + Number(ym.slice(5));
  const x = ym => 38 + 406*(index(ym)-index(first))/Math.max(1,index(last)-index(first));
  const y = v => 166-1.5*v;
  const points = (series, col) => series.map(r => `${x(r[0])},${y(r[col])}`).join(" ");
  const grid = [0,25,50,75,100].map(v => `<path d="M38 ${y(v)}H444" stroke="var(--rule)"/><text x="30" y="${y(v)+4}" text-anchor="end">${v}%</text>`).join("");
  return `<svg class="issue-line" viewBox="0 0 458 195" role="img" aria-label="Estimated share naming the issue in their top three, from ${pct(rows[0][1])} in ${month(first)} to ${pct(rows.at(-1)[1])} in ${month(last)}">
    ${grid}<polygon points="${points(rows,3)} ${points(rows.slice().reverse(),4)}" fill="var(--bt)" opacity=".17"/>
    <polyline points="${points(rows,1)}" fill="none" stroke="var(--bt)" stroke-width="3"/>
    <text x="38" y="190">${month(first)}</text><text x="444" y="190" text-anchor="end">${month(last)}</text></svg>`;
}

function picker(items, id, render) {
  if (!items.length) return "<p>No estimates are available.</p>";
  const options = items.map(i => `<option value="${id}-${i.id}">${i.label}</option>`).join("");
  return `<label class="issue-choice">Issue <select data-issue-picker>${options}</select></label>
    ${items.map((item, i) => `<div class="issue-result" id="${id}-${item.id}"${i ? " hidden" : ""}>${render(item)}</div>`).join("")}`;
}

export function issuesMarkup(data) {
  const items = data?.list || [];
  const ranked = items.filter(i => Number.isFinite(i.imp?.v)).sort((a,b) => b.imp.v-a.imp.v);
  const top = ranked[0], next = ranked[1];
  return {
    overview: () => top ? `<p class="issue-big">${pct(top.imp.v)}</p><p class="issue-lead">put ${top.label.toLowerCase()} among their three most important issues.</p>
      ${next ? `<p class="issue-next">${next.label} ranks second at ${pct(next.imp.v)}.</p>` : ""}` : "<p>No current estimates.</p>",
    priorities: () => ranked.map(i => bar(i.label,i.imp.v,i.imp.lo,i.imp.hi,"var(--bt)")).join(""),
    trust: () => picker(items.filter(i => i.own), "trust", ({own}) =>
      `<h3>${own.leadSig ? parties[own.lead] + " leads" : "No clear leader"}</h3>` +
      Object.entries(parties).map(([k,name]) => bar(name,own.v[k],own.lo[k],own.hi[k],`var(--${k === "onp" ? "on" : k})`)).join("")),
    history: () => picker(items.filter(i => i.salMonthly?.length), "trend", ({salMonthly: rows}) =>
      trend(rows) + `<details><summary>Monthly estimates</summary><table><thead><tr><th>Month</th><th>Top three</th><th>95% interval</th></tr></thead><tbody>${rows.map(r =>
        `<tr><th>${month(r[0])}</th><td>${pct(r[1])}</td><td>${pct(r[3])}–${pct(r[4])}</td></tr>`).join("")}</tbody></table></details>`),
  };
}
