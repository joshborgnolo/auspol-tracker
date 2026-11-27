/* The electoral map page's own figures (/dawn/electoral-map/), from the main site's /map/ data
   (map/data): each 2025 seat's two-candidate count, the House since (data-now.json: members who
   changed party, by-elections) and the seats each party won at every election back to 1993. The
   map itself is /map/'s own engine and data, loaded by the page. */
import fs from "node:fs";
import path from "node:path";

export const YEARS = [1993, 1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
/* the seat bar's groups, in the order it draws them */
export const GROUPS = [["alp", "Labor"], ["lnp", "Coalition"], ["grn", "Greens"], ["onp", "One Nation"], ["ind", "Independents"], ["oth", "Others"]];
export const groupOf = (ab) => (ab === "ALP" ? "alp" : ["LP", "NP", "LNP", "CLP", "LNQ"].includes(ab) ? "lnp" : ab === "GRN" ? "grn" : ab === "ON" ? "onp" : ab === "IND" ? "ind" : "oth");
const PARTY = { ALP: "Labor", LP: "Liberal", NP: "Nationals", LNP: "Liberal National", CLP: "Country Liberal", GRN: "Greens", ON: "One Nation", IND: "Independent", KAP: "Katter’s Australian", XEN: "Centre Alliance", CSA: "Community Strong Australia" };
export const partyName = (ab) => PARTY[ab] || ab;
export function emapData(root) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "map", "data", f), "utf8"));
  const core = read("core-2025.json"), now = read("data-now.json");
  const seats = core.divs.map((D) => {
    /* the count lists the final pair by ballot order: the winner is the larger */
    const [a, b] = [...D.tcp].sort((p, q) => q[1] - p[1]), w = D.c[a[0]], l = D.c[b[0]], total = a[1] + b[1];
    const seat = { n: D.n, st: D.st, cls: D.cls, who: w[0], ab: w[1], vs: l[0], vsAb: l[1], m: Math.round((100 * a[1] / total - 50) * 100) / 100, votes: a[1] - b[1] };
    /* what has changed since: a member's new party, or a by-election's winner */
    const holder = now.holders && now.holders[D.n];
    if (holder) {
      const story = now.changes.filter((c) => c.div === D.n);
      seat.now = { who: holder.n, ab: holder.ab, text: story.length ? story[story.length - 1].text : "", date: story.length ? story[story.length - 1].date : "" };
    }
    return seat;
  });
  const count = (list, ab) => { const o = Object.fromEntries(GROUPS.map(([k]) => [k, 0])); for (const s of list) o[groupOf(ab(s))]++; return o; };
  const history = YEARS.map((y) => {
    const d = y === 2025 ? core : read("core-" + y + ".json"), by = Object.fromEntries(GROUPS.map(([k]) => [k, 0]));
    for (const [ab, n] of Object.entries(d.agg.AUS.seats)) by[groupOf(ab)] += n;
    return { y, date: d.date, seats: by, total: Object.values(by).reduce((t, v) => t + v, 0) };
  });
  const today = { asOf: now.asOf, seats: count(seats, (s) => (s.now ? s.now.ab : s.ab)), changed: seats.filter((s) => s.now).length };
  return { v: 2, asOf: now.asOf, election: { date: core.date }, seats, history, today };
}
