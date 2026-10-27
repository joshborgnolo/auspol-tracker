/* vic_lc_seating.mjs – where each member of Victoria's Legislative Council sits, from the
   Parliament's own council seating plan.

   Reads map/data/lc-seating-plan-vic-2026-10-27.json (built by vic_lc_plan.mjs from the
   Parliament's councilseatingplan page — nothing is re-fetched here): every desk's member,
   and the council's presiding roles as the plan's own position strings name them. Seats every
   member at their desk on the floor the app draws (the @viclc-cells block of
   app/app-3-chamber.js, read as is): a desk the app doesn't draw, a member who isn't the
   council file's, a party that disagrees with it, a desk seated twice or a member left out,
   all fail the build. Writes
     map/data/seats-vic22-lc.json  { plan, source, roles, at: { member: desk } }
   The President's chair (desk 1) isn't a bench desk: its holder is filed as the role, with the
   two leaders' desks (9 and 25, the third down each front column) checked against the floor's
   own table ids so the sorted view parks the leaders where the plan does.
   Run: node .build/map/vic_lc_seating.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DATA = path.join(ROOT, "map", "data");
const YEAR = "vic22";
const PLAN_FILE = path.join(DATA, "lc-seating-plan-vic-2026-10-27.json");

// the plan's PartyAbr strings as the council file's party codes
const PARTY = { ALP: "ALP", LP: "LIB", NAT: "NAT", GRN: "GRN", LC: "LCV", AJP: "AJP", Libertarian: "LDP", SFFP: "SFF", "Family First": "FFP", "One Nation": "ONP", Ind: "IND" };
const LEADERS = { leader: "9", oppLeader: "25" }; // the geometry's table ids

const fail = (msg) => { throw new Error(`vic_lc_seating: ${msg}`); };

// the floor the app draws, from the app's own geometry
const src = fs.readFileSync(path.join(HERE, "app", "app-3-chamber.js"), "utf8");
const block = src.match(/@viclc-cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @viclc-cells-end \*\//);
if (!block) fail("app-3-chamber.js: no @viclc-cells block");
const { VCLC } = new Function(`${block[1]}; return { VCLC };`)();
const drawn = new Set(Object.keys(VCLC.desks));

if (!fs.existsSync(PLAN_FILE)) fail(`${PLAN_FILE} missing — run node .build/map/vic_lc_plan.mjs first`);
const plan = JSON.parse(fs.readFileSync(PLAN_FILE, "utf8"));
const council = JSON.parse(fs.readFileSync(path.join(DATA, `senate-${YEAR}.json`), "utf8"));
const byName = new Map(council.senators.map((x) => [x.n, x]));

const roles = {}, at = {};
const seen = new Set();
for (const [deskAccess, m] of Object.entries(plan.members)) {
  const desk = String(deskAccess);
  const x = byName.get(m.m);
  if (!x) fail(`${m.m} is not a member of the ${YEAR} council file`);
  const ab = PARTY[m.p];
  if (!ab) fail(`${m.m}: unknown PartyAbr "${m.p}"`);
  if (ab !== x.ab) fail(`${m.m} sits ${m.p}, the council file has ${x.ab}`);
  const role = Object.keys(plan.roles).find((r) => plan.roles[r] === m.m);
  if (role === "president") {
    if (desk !== "1") fail(`the President sits at desk ${desk}, desk 1 expected`);
    roles.president = m.m;
    continue; // the chair, not a bench desk
  }
  if (!drawn.has(desk)) fail(`desk ${desk} (${m.m}) is not on the app's floor`);
  if (role) roles[role] = m.m;
  if (seen.has(desk)) fail(`desk ${desk} seated twice`);
  seen.add(desk);
  at[m.m] = desk;
}
for (const [r, desk] of Object.entries(LEADERS)) if (!roles[r] || at[roles[r]] !== desk) fail(`the floor seats its ${r} at desk ${desk}; the plan has ${JSON.stringify(roles)}`);
if (!roles.president || !roles.leader || !roles.oppLeader) fail(`roles off: ${JSON.stringify(roles)}`);
for (const x of council.senators) if (x.n !== roles.president && !(x.n in at)) fail(`${x.n} is not seated`);
if (Object.keys(at).length !== council.senators.length - 1) fail(`${Object.keys(at).length} seated of ${council.senators.length - 1}`);

const out = { plan: plan.captured, source: "the Parliament of Victoria’s council seating plan", roles, at };
fs.writeFileSync(path.join(DATA, `seats-${YEAR}-lc.json`), `${JSON.stringify(out, null, 1)}\n`);
console.log(`map/data/seats-${YEAR}-lc.json`, Object.keys(at).length, "seated;");
console.log(`roles: ${roles.president} / ${roles.leader} / ${roles.oppLeader}`);
