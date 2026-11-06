// The map headline's primary breakdowns: counted vote pools, consistent
// comparison columns, cycle/list navigation, and frame-specific availability.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8");
const FAMS = ["alp", "lnp", "grn", "onp", "ind", "oth"];
const CLS = ["Inner Metropolitan", "Outer Metropolitan", "Provincial", "Rural"];
const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const names = { NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland", WA: "Western Australia", SA: "South Australia", TAS: "Tasmania", ACT: "Australian Capital Territory", NT: "Northern Territory" };
const labels = { alp: "Labor", lnp: "Coalition", grn: "Greens", onp: "One Nation", ind: "Independents", oth: "Others" };
let current, focusCount = 0;
// the app's own holdFam/crossLabel, for the test both as ctx globals and as oracle
const holdFamT = (h) => (h.ab === "CSA" ? "csa" : h.fam);
const crossLabelT = (h) => (h.ab === "CSA" ? "Community Strong" : h.fam === "ind" ? "Independents" : h.fam === "grn" ? "Greens" : h.fam === "onp" ? "One Nation" : (h.ab === "XEN" ? "Nick Xenophon Team" : h.ab === "CS" ? "Community Strong" : ({ KAP: "Katter", CA: "Centre Alliance", ASP: "Shooters", LNQ: "LNP", CLP: "CLP", JLN: "Lambie Network" })[h.ab] || h.pn || h.ab));
const ctx = vm.createContext({
  FAMS, CLS, STATES, STATE_TITLE: names, CLS_SHORT: Object.fromEntries(CLS.map((c) => [c, c.replace(" Metropolitan", " metro")])),
  STATE_YEARS: new Set(["nsw23"]), S: { year: 2025 }, TH: { party: Object.fromEntries([...FAMS,"nxt","dem"].map((f) => [f,f])) },
  SA_YEARS: new Set(), VIC_YEARS: new Set(), WA_YEARS: new Set(), QLD_YEARS: new Set(),
  css: (c) => c, esc: (s) => String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;"), f1: (n) => n.toFixed(1), sgn: (n) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(1),
  famLeg: (f) => labels[f], partyShort: (ab,pn) => pn || ab, holdFam: holdFamT, crossLabel: crossLabelT,
  isNowY: (y) => y === "now", frameBaseY: () => 2025, M: () => current, FS: { on: false },
  $: () => ({ focus() { focusCount++; } }),
});
vm.runInContext(read(".build/map/app/app-4-story.js"), ctx, { filename: "app-4-story.js" });
const api = vm.runInContext("({statClassArea,statPrimaryCols,statOthersRows,statSeatsOthersRows,statPrimaryGrid,statScopeOf,statBreakdownRows,statBreakdownView,statBreakdown,statBreakdownClick,statBreakdowns})",ctx);
function model(year) {
  const res = JSON.parse(read(`map/data/core-${year}.json`));
  const divs = res.divs.map((d,i) => {
    const w = (d.h && d.h.length && d.c.find((c) => c[1] === d.h[d.h.length-1][2])) || d.c.reduce((a,b) => (a[4] > b[4] ? a : b));
    return {i, cls:d.cls, st:d.st, formal:d.c.reduce((n,c) => n+c[4],0), c:d.c.map((c) => ({ab:c[1],pn:c[2],fam:c[3],v:c[4]})), hold:{ab:w[1],pn:w[2],fam:w[3]}};
  });
  const areas = Object.fromEntries(Object.entries(res.agg).map(([st,a]) => [st, {
    idx:divs.filter((d) => st === "AUS" || d.st === st).map((d) => d.i), formal:a.formal,
    fp:Object.fromEntries(FAMS.map((f) => [f,100*a.prim[f]/a.formal])),
    fpSw:Object.fromEntries(FAMS.map((f) => [f,a.pformal ? 100*a.prim[f]/a.formal-100*a.pprim[f]/a.pformal : null])),
    tpp:a.tpp[0]+a.tpp[1] ? 100*a.tpp[0]/(a.tpp[0]+a.tpp[1]) : null,
  }]));
  return {year,res,divs,areas};
}
const close = (a,b,note) => assert.ok(Math.abs(a-b)<1e-8,`${note}: ${a} versus ${b}`);
current = model(2025);
const groups = api.statBreakdownRows(current,"AUS");
assert.equal(groups.states.length,8);
assert.equal(groups.classes.length,4);
assert.equal(groups.states[0].label,"New South Wales");
assert.equal(api.statBreakdownView(current,"AUS","states").mode,"closed");
for (const r of [...groups.states,...groups.classes]) {
  close(api.statPrimaryCols(current,r.A).reduce((n,c) => n+c[1],0),100,`${r.label} primary shares sum to 100`);
  const raw = r.A.idx.map((i) => current.res.divs[i]);
  const t = raw.reduce((a,d) => [a[0]+(d.tpp?.[0] || 0),a[1]+(d.tpp?.[1] || 0)],[0,0]);
  close(r.A.tpp,100*t[0]/(t[0]+t[1]),`${r.label} uses counted two-party votes`);
}
// A smaller final count must not be weighted as if every formal vote reached it.
const partial = {res:{divs:[{c:[["a","ALP","Labor","alp",100]],tpp:[40,10]},{c:[["b","ALP","Labor","alp",900]],tpp:[90,810]}]}};
close(api.statClassArea(partial,[0,1]).tpp,100*130/950,"2PP denominator is counted 2PP, not primary formal");
partial.res.divs[1].tpp = null;
assert.equal(api.statClassArea(partial,[0,1]).nTpp,1);
close(api.statClassArea(partial,[0,1]).tpp,80,"missing counts are excluded");
partial.res.divs[0].tpp = null;
assert.equal(api.statClassArea(partial,[0,1]).tpp,null);

function click(kind,action,index) {
  const el = {dataset:{pvKind:kind,pvArea:"AUS"},outerHTML:""};
  api.statBreakdownClick({dataset:{pvAction:action,pvIndex:index},closest:() => el});
  return el.outerHTML;
}
let html = click("states","cycle");
assert.match(html,/NSW primaries/);
assert.match(html,/NSW 2PP/);
assert.ok(html.indexOf("NSW primaries")<html.indexOf("NSW 2PP"));
assert.match(html,/55\.3/);
for(let i=0;i<8;i++) html=click("states","cycle");
assert.match(html,/NSW primaries/,"cycle wraps around");
html=click("states","list");
assert.equal((html.match(/data-pv-action="pick"/g)||[]).length,8);
assert.match(html,/aria-expanded="true"/);
html=click("states","pick","5");
assert.match(html,/Tasmania primaries/);
assert.match(html,/Tasmania 2PP/);
click("states","list");
assert.match(click("states","list"),/id="st-pv-states" hidden/,"list can collapse");
assert.equal(api.statBreakdownView(current,"AUS","classes").mode,"closed","groups are independent");
assert.match(click("classes","cycle"),/Inner-metro 2PP/);
assert.ok(focusCount>0,"replacing a group restores keyboard focus");

const now = model(2025); now.year="now";
// A later by-election must not leak into the base-election primaries or 2PP.
now.divs[0]={...now.divs[0],formal:1,c:[{fam:"oth",ab:"X",pn:"Example",v:1}],by:{prev:now.divs[0]}};
const nowRows=api.statBreakdownRows(now,"AUS");
for(let i=0;i<4;i++) close(nowRows.classes[i].A.tpp,groups.classes[i].A.tpp,"Now keeps election-class 2PP");
assert.deepEqual(JSON.parse(JSON.stringify(api.statPrimaryCols(now,nowRows.states[0].A))),JSON.parse(JSON.stringify(api.statPrimaryCols(current,groups.states[0].A))));
assert.equal(api.statBreakdownRows(model(1993),"AUS").classes.length,0,"unclassified elections omit seat types");
assert.equal(api.statBreakdownRows(model("nsw23"),"AUS").states.length,0,"state elections omit a redundant state selector");
assert.equal(api.statBreakdownRows(current,"NSW").states.length,0,"a selected state does not repeat all states");
const old=model(2016), oldRows=api.statBreakdownRows(old,"AUS").states;
const keys=[...new Set(oldRows.flatMap((r)=>api.statPrimaryCols(old,r.A).map((c)=>c[4])))].filter((k)=>!["alp","lnp","oth"].includes(k));
assert.ok(keys.some((k)=>k.startsWith("party:")),"regional parties above 10% get a column");
const order=api.statPrimaryCols(old,oldRows[0].A,keys).map((c)=>c[4]).join("|");
for(const r of oldRows) {
  const cols=api.statPrimaryCols(old,r.A,keys);
  assert.equal(cols.map((c)=>c[4]).join("|"),order,"every comparison row has the same party order");
  close(cols.reduce((n,c)=>n+c[1],0),100,"shared columns preserve the primary total");
}
// the head's "Others" figure opens into the bloc inside it
const cols25=api.statPrimaryCols(current,current.areas.AUS),oth25=cols25[cols25.length-1][1];
const rows25=api.statOthersRows(current.areas.AUS,cols25);
close(rows25.reduce((n,r)=>n+r[1],0),oth25,"the Others breakdown reproduces the Others figure");
assert.deepEqual(JSON.parse(JSON.stringify(rows25.map((r)=>r[3]))),["Independents","One Nation","All other parties"]);
assert.ok(!rows25.some((r)=>r[4]==="grn"),"the Greens' own column stays out of the breakdown");
let g=api.statPrimaryGrid(current,current.areas.AUS,"",true);
assert.match(g,/class="st-othb"/,"the figure carries its opener when shut");
assert.match(g,/aria-expanded="false"/);
assert.ok(g.includes(`<b>${oth25.toFixed(1)}</b>`),"the shut figure shows the Others total");
assert.ok(!g.includes("st-othx"),"nothing lists while shut");
api.statScopeOf(current).open=true;
g=api.statPrimaryGrid(current,current.areas.AUS,"",true);
assert.ok(!g.includes("st-othb"),"the figure button is gone once open");
assert.match(g,/repeat\(5,auto\)/,"the remaining figures recentre on one fewer column");
assert.match(g,/class="st-othx"/);
for(const r of rows25) {
  assert.ok(g.includes(`${r[3]} <b>${r[1].toFixed(1)}</b>`),`open line shows ${r[3]}`);
  assert.ok(g.includes(`<small>${(r[2]>=0?"+":"−")+Math.abs(r[2]).toFixed(1)}</small>`),`open line shows ${r[3]}'s change`);
}
assert.ok(!api.statPrimaryGrid(current,current.areas.AUS).includes("st-othb"),"the breakdown cycle view's grid keeps a plain figure");
api.statScopeOf(current).open=false;
api.statScopeOf(now).open=true;
const gNow=api.statPrimaryGrid(now,now.areas.AUS,"",true);
assert.ok(gNow.includes("st-othx"),"an as-it-stands frame lists its Others too");
assert.ok(!gNow.includes("<small"),"an as-it-stands frame carries no change figures");
api.statScopeOf(now).open=false;
const colsSa16=api.statPrimaryCols(old,old.areas.SA),nxt16=colsSa16.find((c)=>c[4].startsWith("party:"));
assert.ok(nxt16,"Xenophon stands out of South Australia's Others");
const rowsSa16=api.statOthersRows(old.areas.SA,colsSa16);
close(rowsSa16.reduce((n,r)=>n+r[1],0),colsSa16[colsSa16.length-1][1],"SA's breakdown reproduces its Others figure");
close(rowsSa16.find((r)=>r[4]==="oth")[1],old.areas.SA.fp.oth-nxt16[1],"the lump excludes the broken-out party");
assert.equal(rowsSa16.find((r)=>r[4]==="oth")[2],null,"a lump beside a breakout carries no change");
// the Seats row's "Others" figure opens into the crossbench groups inside it
const idx25=current.areas.AUS.idx,want25={};
for (const i of idx25) {
  const h=current.divs[i].hold,f=holdFamT(h);
  if(f==="alp"||f==="lnp") continue;
  const k=crossLabelT(h);
  want25[k]=(want25[k]||0)+1;
}
const sRows25=api.statSeatsOthersRows(current,idx25,[],null);
assert.deepEqual(JSON.parse(JSON.stringify(Object.fromEntries(sRows25.map((r)=>[r[3],r[1]])))),want25,"the seats breakdown names every crossbench group once");
close(sRows25.reduce((n,r)=>n+r[1],0),Object.values(want25).reduce((a,b)=>a+b,0),"the seats breakdown reproduces the Others tally");
assert.equal(sRows25[0][3],"Independents","independents lead the 2025 crossbench");
const sN25=sRows25.map((r)=>r[1]);
assert.ok(sN25.every((v,k)=>k===0||sN25[k-1]>=v),"seat groups sort biggest first");
assert.ok(sRows25.every((r)=>r[2]===null),"no base means no changes");
const noKatter=api.statSeatsOthersRows(current,idx25,["Katter"],null);
assert.ok(!noKatter.some((r)=>r[3]==="Katter"),"a group with its own seat column stays out");
assert.equal(noKatter.reduce((n,r)=>n+r[1],0),Object.values(want25).reduce((a,b)=>a+b,0)-1);
const withBase=api.statSeatsOthersRows(current,idx25,[],{c:{ind:10,grn:4,onp:0,oth:1}});
assert.equal(withBase.find((r)=>r[3]==="Independents")[2],0,"a group's change rides its family's own base");
assert.equal(withBase.find((r)=>r[3]==="Greens")[2],-3);
assert.equal(withBase.find((r)=>r[3]==="Katter")[2],null,"a party sharing 'oth' claims none of the family's shift");
console.log("Map primary breakdowns: counted pools, scope labels, cycle/list navigation, Others expansion (votes and seats), historical and Now frames passed.");
