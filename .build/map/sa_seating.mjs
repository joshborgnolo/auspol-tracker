/* sa_seating.mjs – where each member of South Australia's Parliament sits, from its chamber maps.

   Reads the latest .build/map/src/sa-chambers/<ha|lc>-<date>.json.gz (sa_chambers_fetch.mjs): each
   desk's name, the member at it, and the member's card (full name, party, electorate). Seats every
   member at their desk in the floors the app draws (the @sa-cells block of app/app-3c-sa.js, read
   as is): a desk the app doesn't draw, a member who isn't the frame's, a party that disagrees with
   the results, a district or member seated twice or left out, all fail the build. Writes
     map/data/seats-<year>.json     { plan, source, at: { district: desk } }   the House of Assembly
     map/data/seats-<year>-lc.json  { plan, source, roles, at: { member: desk } }   the Council
   The Speaker's chair (T1) and the President's (N1) aren't desks: their holder must be the one the
   app puts there (SPEAKER_DIV in app-1-base.js; the council's President is filed as a role, with
   the leaders on the desks the floor plan names "Leader of the Government" and "of the Opposition").
   YEAR is the frame the plan seats: the Parliament the 2026 election returned. Run:
     node .build/map/sa_seating.mjs */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DATA = path.join(ROOT, "map", "data");
const SRC = path.join(HERE, "src", "sa-chambers");
const YEAR = "sa26";
const SPEAKER = { desk: "T1", div: "Hurtle Vale" };
const PRESIDENT = "N1";
const LEADS = { leader: "A1", oppLeader: "D1" };
// the chamber map's name where the results file has another: Laura Curran sits as Laura Henderson
const ALIAS = { "Laura Henderson": "Laura Curran" };
// the cards' parties as the results files abbreviate them
const PARTY = { "Australian Labor Party": "ALP", "Liberal Party": "LIB", "Pauline Hanson's One Nation": "ONP", "One Nation": "ONP", "The Greens": "GRN", "Greens": "GRN", "Greens SA": "GRN", Independent: "IND", "Family First Party": "FFP" };
// a member whose party the chamber map gives otherwise than the frame's council file, as filed: the
// file has Sarah Game (elected for One Nation in 2022) sitting for Fair Go for Australians at the
// 2026 election; the October 2026 map lists her as Family First. The seat stands; the party is the file's
const PARTY_AS_FILED = { "Sarah Game": ["FFP", "FGA"] };

// the floors, from the app's own geometry
const src = fs.readFileSync(path.join(HERE, "app", "app-3c-sa.js"), "utf8");
const block = src.match(/@sa-cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @sa-cells-end \*\//);
if (!block) throw new Error("app-3c-sa.js: no @sa-cells block");
const { SAF, saCells } = new Function(`${block[1]}; return { SAF, saCells };`)();
const desksOf = (k) => new Set(saCells(SAF[k]).map((c) => c.id));

const latest = (key) => {
  const files = fs.readdirSync(SRC).filter((f) => f.startsWith(`${key}-`) && f.endsWith(".json.gz")).sort();
  if (!files.length) throw new Error(`no ${key} cache in ${path.relative(ROOT, SRC)}: run sa_chambers_fetch.mjs`);
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(SRC, files[files.length - 1]))).toString("utf8"));
};
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
// every member at a desk: { desk, surname, name, party, electorate }
function read(key) {
  const c = latest(key);
  const v = JSON.parse(c.startup)[1].value;
  const desks = new Map([...v.matchAll(/<div id ='(\d+)' name ='([^']*)'/g)].map((m) => [m[1], m[2]]));
  const out = [];
  for (const m of v.matchAll(/<div id ="(\d+)" style ="[^"]*" class="employeepanel [^"]*" deskid="(\d+)">([\s\S]*?)<\/div>/g)) {
    const f = Object.fromEntries([...m[3].matchAll(/<span f='(\w+)' class='canedit'>([^<]*)<\/span>/g)].map((x) => [x[1], x[2]]));
    const card = c.cards[m[1]];
    if (!card) throw new Error(`${key}: no card for ${f.lastname}`);
    const field = (id) => { const x = card.match(new RegExp(`id="${id}" class="value">([\\s\\S]*?)</div>`)); return x ? text(x[1]) : null; };
    const name = text((card.match(/<div class="CustomHTML">([\s\S]*?)<\/div>/) || [])[1] || "").replace(/^((Hon|Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+)+/, "");
    const desk = desks.get(m[2]);
    if (!desk) throw new Error(`${key}: ${name} at an unknown desk`);
    if (field("deskname") !== desk) throw new Error(`${key}: ${name}'s card says ${field("deskname")}, the floor ${desk}`);
    out.push({ desk, surname: f.lastname, name, party: field("politicalparty"), electorate: field("electorate") });
  }
  return { fetched: c.fetched, url: c.url, members: out };
}
const longDate = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const partyOf = (p, who) => { if (!(p in PARTY)) throw new Error(`${who}: unknown party "${p}"`); return PARTY[p]; };
const once = (list, what) => { const seen = new Set(); for (const x of list) { if (seen.has(x)) throw new Error(`${what} ${x} seated twice`); seen.add(x); } };
const write = (f, j) => { fs.writeFileSync(path.join(DATA, f), JSON.stringify(j, null, 1) + "\n"); console.log(`map/data/${f}`, Object.keys(j.at).length, "seated"); };

// ----- the House of Assembly -----
{
  const p = read("ha"), drawn = desksOf("ha");
  const data = JSON.parse(fs.readFileSync(path.join(DATA, `data-${YEAR}.json`), "utf8"));
  const won = new Map(data.divs.map((d) => [d.n, d.c.find((c) => c[6] === 1)]));
  const at = {};
  for (const m of p.members) {
    const w = won.get(m.electorate);
    if (!w) throw new Error(`House: ${m.name}'s ${m.electorate} is not a district of ${YEAR}`);
    if (w[0] !== m.name) throw new Error(`House: ${m.electorate} sits ${m.name}, the results elected ${w[0]}`);
    // a Speaker sits apart from their party in the chair; the card may say so
    if (m.desk !== SPEAKER.desk && partyOf(m.party, m.name) !== w[1]) throw new Error(`House: ${m.name} sits ${m.party}, elected ${w[1]}`);
    if (m.desk === SPEAKER.desk) { if (m.electorate !== SPEAKER.div) throw new Error(`House: the chair holds ${m.electorate}, the app puts ${SPEAKER.div} there`); continue; }
    if (!drawn.has(m.desk)) throw new Error(`House: desk ${m.desk} (${m.name}) is not on the app's floor`);
    at[m.electorate] = m.desk;
  }
  once(Object.values(at), "House desk");
  if (Object.keys(at).length !== data.divs.length - 1) throw new Error(`House: ${Object.keys(at).length} seated of ${data.divs.length - 1}`);
  write(`seats-${YEAR}.json`, { plan: longDate(p.fetched), source: p.url, at });
}

// ----- the Legislative Council -----
{
  const p = read("lc"), drawn = desksOf("lc");
  const council = JSON.parse(fs.readFileSync(path.join(DATA, `senate-${YEAR}.json`), "utf8"));
  const by = new Map(council.senators.map((x) => [x.n, x]));
  const at = {}, roles = {};
  for (const m of p.members) {
    const n = ALIAS[m.name] || m.name, x = by.get(n);
    if (!x) throw new Error(`Council: ${m.name} is not a member of the ${YEAR} council`);
    const ab = partyOf(m.party, m.name), filed = PARTY_AS_FILED[n];
    if (ab !== x.ab && !(filed && filed[0] === ab && filed[1] === x.ab)) throw new Error(`Council: ${m.name} sits ${m.party}, the file has ${x.ab}`);
    if (m.desk === PRESIDENT) { roles.president = n; continue; }
    if (!drawn.has(m.desk)) throw new Error(`Council: desk ${m.desk} (${m.name}) is not on the app's floor`);
    for (const [r, d] of Object.entries(LEADS)) if (m.desk === d) roles[r] = n;
    at[n] = m.desk;
  }
  once(Object.values(at), "Council desk");
  if (!roles.president || !roles.leader || !roles.oppLeader) throw new Error(`Council: roles ${JSON.stringify(roles)}`);
  if (Object.keys(at).length !== council.senators.length - 1) throw new Error(`Council: ${Object.keys(at).length} seated of ${council.senators.length - 1}`);
  write(`seats-${YEAR}-lc.json`, { plan: longDate(p.fetched), source: p.url, roles, at });
}
