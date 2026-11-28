// Factor the multinomial into fair vs other, then good vs poor among the rest.
// Independent Gaussian random walks on the two logits. Integrate each over
// an equally weighted grid of monthly step sizes and smooth backwards.
const logits = Array.from({length:151}, (_,i)=>(i-75)*0.04);
const p = logits.map(x=>1/(1+Math.exp(-x)));
const unit = a => { const s=a.reduce((x,y)=>x+y,0); return a.map(x=>x/s); };
const expWeights = a => unit(a.map(x=>Math.exp(x-Math.max(...a))));
const dot = (a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const month = s=>12*Number(s.slice(0,4))+Number(s.slice(5));

function fit(waves, conditional, speeds){
  const fits=speeds.map(speed=>{
    let prior=p.map(()=>1/p.length), evidence=0;
    const steps=waves.map(([date,g,b,n],i)=>{
      let kernel=null;
      if(i){
        const variance=speed**2*(month(date)-month(waves[i-1][0]));
        kernel=logits.map(x=>unit(logits.map(y=>Math.exp(-0.5*(x-y)**2/variance))));
        prior=p.map((_,j)=>prior.reduce((s,v,k)=>s+v*kernel[k][j],0));
      }
      const yes=n*(conditional?g:100-g-b)/100;
      const no=n*(conditional?b:g+b)/100;
      const ll=p.map(v=>yes*Math.log(v)+no*Math.log1p(-v));
      const peak=Math.max(...ll), lik=ll.map(v=>Math.exp(v-peak));
      const before=evidence, forecast=dot(prior,p);
      evidence+=Math.log(dot(prior,lik))+peak;
      prior=unit(prior.map((v,j)=>v*lik[j]));
      return {kernel,lik,filtered:prior,before,forecast};
    });
    let back=p.map(()=>1);
    for(let i=steps.length-1;i>=0;i--){
      const s=steps[i];s.post=unit(s.filtered.map((v,j)=>v*back[j]));
      if(i){const next=s.lik.map((v,j)=>v*back[j]);back=unit(s.kernel.map(row=>dot(row,next)));}
    }
    return {steps,evidence};
  });
  const weights=expWeights(fits.map(f=>f.evidence));
  return waves.map((_,i)=>({
    forecast:dot(expWeights(fits.map(f=>f.steps[i].before)),fits.map(f=>f.steps[i].forecast)),
    post:p.map((_,j)=>dot(weights,fits.map(f=>f.steps[i].post[j])))
  }));
}

export function cohesionModel(waves,speeds=[0.04,0.09,0.18,0.36]){
  const fair=fit(waves,false,speeds), balance=fit(waves,true,speeds);
  return waves.map(([date,g,b],i)=>{
    const summarize=positive=>{
      const mass=new Float64Array(1001);let mean=0;
      fair[i].post.forEach((w,j)=>balance[i].post.forEach((z,k)=>{
        const share=100*(1-p[j])*(positive?p[k]:1-p[k]);
        mass[Math.round(share*10)]+=w*z;mean+=w*z*share;
      }));
      let sum=0,lo,hi;
      mass.forEach((w,j)=>{sum+=w;if(lo==null&&sum>=0.025)lo=j/10;if(hi==null&&sum>=0.975)hi=j/10});
      return {v:+mean.toFixed(1),lo,hi};
    };
    const other=100*(1-fair[i].forecast);
    return {date,g,b,good:summarize(true),poor:summarize(false),forecast:[other*balance[i].forecast,other*(1-balance[i].forecast)]};
  });
}
