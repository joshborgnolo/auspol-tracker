const BARE = { "News24": 1, "Capital Brief": 1, "News.com.au": 1, "News Australia": 1, Amplify: 1 };
const COMMISSIONED = { "Blueprint Institute": 1, "Climate Council": 1, "Australia Inst.": 1, Amplify: 1 };
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

export function houseName(house) {
  return house === "EMRS (Tas)" ? "EMRS" : house;
}

export function sampleBase(code) {
  return `<span class="sample-base">${esc(code)}</span>`;
}

/* The main ledger's rdPollHead, over Dawn's schema. An effective sample is
   shown only when the house publishes it. */
export function pollHeading(p) {
  let sample = "an unpublished sample";
  if (p.n != null) {
    const efficiency = p.se != null ? "(eff. " + N(p.se) + ")" : "(eff. undisclosed)";
    sample = `a sample of <span class="nocaps">${N(p.n)}${p.b ? ` (${sampleBase(p.b)})` : ""} ${efficiency}</span>`;
  }
  const self = p.conf || !(p.c && !/^self/i.test(p.c));
  const by = (!self && COMMISSIONED[p.c] ? "commissioned by " : "published by ") + (self ? houseName(p.h) : client(p.c));
  const when = out(p.pub);
  const field = p.tbc ? "dates TBC" : esc(p.f || (Number(p.d.slice(8, 10)) + " " + MONTH[Number(p.d.slice(5, 7)) - 1]));
  return `Conducted on ${field} from ${sample}, ${esc(by)}${when ? " on " + when : ""}.`;
}
