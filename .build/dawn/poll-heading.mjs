const BARE = { "News24": 1, "Capital Brief": 1, "News.com.au": 1, "News Australia": 1, Amplify: 1 };
const COMMISSIONED = { "Blueprint Institute": 1, "Climate Council": 1, "Australia Inst.": 1, Amplify: 1 };
const APPROX = new Set(["Roy Morgan", "Spectre Strategy", "Resolve", "EMRS (Tas)"]);
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], N = v => Number(v).toLocaleString("en-AU");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const client = name => /^the /i.test(name) || BARE[name] ? name : "the " + name;
const out = stamp => {
  if (!stamp) return null;
  const d = new Date(String(stamp).slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  let s = DAY[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTH[d.getUTCMonth()];
  const m = /T(\d{2}):/.exec(stamp);
  if (m) s += ", " + (Number(m[1]) % 12 || 12) + (Number(m[1]) < 12 ? " am" : " pm");
  return s;
};

/* The main ledger's rdPollHead, over Dawn's schema. p.eb already carries
   the TBC/missing verdict reached while the wave is filed. */
export function pollHeading(p, deff) {
  let sample = "an unpublished sample", estimate = null;
  if (p.n != null) {
    sample = "a sample of ";
    const eb = p.eb && String(p.eb).startsWith("~") ? Number(String(p.eb).slice(1)) : null;
    estimate = p.se == null && eb == null && APPROX.has(p.h) ? Math.round(p.n / (deff || 1.6) / 10) * 10 : eb;
    const efficiency = p.se != null ? "(eff. " + N(p.se) + ")"
      : p.eb === "TBC" ? "(eff. TBC)" : p.eb === "missing" ? "(eff. missing)"
      : estimate != null ? "(eff. ~" + N(estimate) + ")" : "";
    sample += `<span class="nocaps"${estimate != null ? ' title="Estimated from the raw sample and the site’s design effect; the house publishes no effective sample"' : ""}>${N(p.n)}${p.b ? ` (${esc(p.b)})` : ""}${efficiency ? ` ${efficiency}` : ""}</span>`;
  }
  const self = p.conf || !(p.c && !/^self/i.test(p.c));
  const by = (!self && COMMISSIONED[p.c] ? "commissioned by " : "published by ") + (self ? p.h : client(p.c));
  const when = out(p.pub);
  const field = p.tbc ? "dates TBC" : esc(p.f || (Number(p.d.slice(8, 10)) + " " + MONTH[Number(p.d.slice(5, 7)) - 1]));
  return `Conducted on ${field} from ${sample}, ${esc(by)}${when ? " on " + when : ""}.`;
}
