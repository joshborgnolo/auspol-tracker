// Gaussian random walk on log odds, with constant survey/method offsets.
// Conditioning its joint normal distribution gives both historical smoothing
// and forward prediction. Each fit integrates over the volatility grid.
import fs from 'node:fs';
const history=JSON.parse(fs.readFileSync(new URL('../../data/immigration-history.json',import.meta.url)));
const pct=z=>100/(1+Math.exp(-z));
const logit=v=>Math.log(v/(100-v));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);

function observations(block){
  const rows=[];
  for(const [house,archive] of Object.entries(history)){
    for(const [year,v] of archive.rows){
      const scan=house==='scanlon';
      const era=scan?(year<2018?'telephone':year<2025?'LiA':'current'):(year<=2018?'telephone':'panel');
      rows.push({x:year+(scan?.5:.25),label:String(year),v,house,key:house+'-'+era,se:1.8,
        // Annual series provide years, not publication dates. Use conservative
        // availability dates for validation, not for the retrospective fit.
        available:year+(scan?(year===2026?.847:.95):.55),direct:true});
    }
  }
  for(const panel of block.panels){
    for(const q of panel.points){
      if(panel.house==='scanlon' && history.scanlon.rows.some(([y])=>y===Math.floor(q.x)))continue;
      const release=q.pub?Number(q.pub.slice(0,4))+(Date.parse(q.pub.slice(0,10))-Date.UTC(+q.pub.slice(0,4),0,1))/31557600000:q.x+.02;
      rows.push({x:q.x,label:q.wave,v:q.v,house:panel.house,key:panel.house==='scanlon'?'scanlon-current':panel.house,se:q.se||1.8,available:release,direct:panel.fam===0});
    }
  }
  return rows.sort((a,b)=>a.x-b.x);
}

const anchor='scanlon-current';
const baseYear=2007;
function fit(rows){
  const settings=[.12,.24,.40,.65].map(speed=>{
    const cov=(a,b)=>1+speed**2*(Math.min(a.x,b.x)-baseYear)+(a.key===b.key&&a.key!==anchor?.25**2:0);
    const noise=r=>((r.se/(r.v*(1-r.v/100)))**2+.07**2);
    const L=[],z=[];
    let score=0;
    for(const [i,r] of rows.entries()){
      const row=[];
      for(let j=0;j<i;j++){
        let cross=cov(r,rows[j]);
        for(let k=0;k<j;k++)cross-=row[k]*L[j][k];
        row.push(cross/L[j][j]);
      }
      const sd=Math.sqrt(cov(r,r)+noise(r)-dot(row,row));
      const residual=(logit(r.v)-dot(row,z))/sd;
      score-=Math.log(sd)+residual**2/2;
      row.push(sd);L.push(row);z.push(residual);
    }
    function predict(target){
      const cross=[];
      for(const [i,r] of rows.entries()){
        let v=cov(target,r);
        for(let j=0;j<i;j++)v-=L[i][j]*cross[j];
        cross.push(v/L[i][i]);
      }
      return {mu:dot(cross,z),sd:Math.sqrt(cov(target,target)-dot(cross,cross)+(target.se?noise(target):0))};
    }
    return {score,predict};
  });
  const max=Math.max(...settings.map(s=>s.score));
  const weights=settings.map(s=>Math.exp(s.score-max)),total=weights.reduce((a,b)=>a+b);
  return target=>{
    const mix=settings.map(s=>s.predict(target));
    // Normal CDF approximation, absolute error below 1e-6.
    const cdf=x=>{
      const a=Math.abs(x),t=1/(1+.2316419*a);
      const tail=Math.exp(-a*a/2)/Math.sqrt(2*Math.PI)*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
      return x>=0?1-tail:tail;
    };
    function quantile(prob){
      let lo=-8,hi=8;
      for(let i=0;i<32;i++){
        const mid=(lo+hi)/2;
        if(dot(weights,mix.map(p=>cdf((mid-p.mu)/p.sd)))/total<prob)lo=mid;else hi=mid;
      }
      return +pct((lo+hi)/2).toFixed(2);
    }
    return {v:quantile(.5),lo:quantile(.025),hi:quantile(.975)};
  };
}

export function immigrationModel(block){
  const all=observations(block),scores=[];
  for(const r of all.filter(r=>r.direct)){
    // The 2025 report originally printed 51%. Figure 17 of the 2026 report
    // supplies the revised comparable 50%. Use the vintage then available.
    const vintage=q=>q.key===anchor && q.label==="2025" && r.x<2026.847 ? {...q,v:51}:q;
    const target=vintage(r);
    const prior=all.filter(q=>q.available<r.x && q.x<r.x).map(vintage);
    if(!prior.some(q=>!q.direct))continue;
    const last=prior.filter(q=>q.house===r.house).at(-1);
    const direct=fit(prior.filter(q=>q.direct))(target),expanded=fit(prior)(target);
    scores.push({label:r.label,house:r.house,v:target.v,direct,expanded,last:last?.v??null});
  }
  const error=(cases,k)=>cases.reduce((s,r)=>s+Math.abs(r.v-r[k].v),0);
  const coverage=k=>scores.filter(r=>r.v>=r[k].lo&&r.v<=r[k].hi).length;
  // Keep policy questions only if their gain also holds for repeat surveys,
  // where the prior observation identifies the survey's own level.
  const repeat=scores.filter(r=>r.last!=null);
  const improves=cases=>cases.length>0 && error(cases,'expanded')<error(cases,'direct');
  const pooled=scores.length>=5 && improves(scores) && improves(repeat) && coverage('expanded')>=coverage('direct');
  const rows=all.filter(r=>pooled||r.direct),estimate=fit(rows);
  const first=rows[0].x,last=rows.at(-1).x;
  const times=[...new Set([...rows.map(r=>r.x),...Array.from({length:Math.floor((last-first)*12)},(_,i)=>first+(i+1)/12)])].sort((a,b)=>a-b);
  const trend=times.map(x=>({x,...estimate({x,key:anchor})}));
  return {trend,rows:rows.map(({x,label,v,house,key})=>({x,label,v,house,key})),pooled,scores,
    sources:Object.fromEntries(Object.entries(history).map(([k,v])=>[k,v.source]))};
}
