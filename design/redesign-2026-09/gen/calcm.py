import os
import json, math, datetime as dt
d=json.load(open('data/polls.json')); E=d['elections']
e25=[v for k,v in E.items() if v['date'].startswith('2025')][0]; print('e2025',e25)
P=[p for p in d['polls'] if p['date']>='2025-05-04']
def day(s): return dt.date.fromisoformat(s)
t0=day('2025-05-03'); t1=day('2026-09-26')
def get(p,k):
  if k=='oth': 
    v=(p.get('oth') or 0)+(p.get('ind') or 0); return v if (p.get('oth') is not None or p.get('ind') is not None) else None
  return p.get(k)
parties=['onp','alp','lnp','grn','oth']
# geometry
L,R,T,B=12,262,34,270; YMAX=40
X=lambda t:L+(t-t0).days/(t1-t0).days*(R-L)
Y=lambda v:B-v/YMAX*(B-T)
out={}
last=max(day(p['date']) for p in P)
for k in parties:
  pts=[(day(p['date']),get(p,k)) for p in P if get(p,k) is not None]
  dots=''.join(f'M{X(t):.0f} {Y(v):.1f}h0' for t,v in pts)
  line=[];up=[];lo=[]
  t=t0+dt.timedelta(days=10)
  while t<=last:
    ws=[math.exp(-0.5*((t-s).days/28)**2) for s,_ in pts]
    W=sum(ws); m=sum(w*v for w,(s,v) in zip(ws,pts))/W
    var=sum(w*(v-m)**2 for w,(s,v) in zip(ws,pts))/W
    se=math.sqrt(var)*math.sqrt(sum(w*w for w in ws))/W
    line.append((t,m));up.append((t,m+1.645*se));lo.append((t,m-1.645*se))
    t+=dt.timedelta(days=10)
  if line[-1][0]!=last:
    t=last;ws=[math.exp(-0.5*((t-s).days/28)**2) for s,_ in pts];W=sum(ws);m=sum(w*v for w,(s,v) in zip(ws,pts))/W
    var=sum(w*(v-m)**2 for w,(s,v) in zip(ws,pts))/W;se=math.sqrt(var)*math.sqrt(sum(w*w for w in ws))/W
    line.append((t,m));up.append((t,m+1.645*se));lo.append((t,m-1.645*se))
  lp='M'+'L'.join(f'{X(t):.0f} {Y(v):.1f}' for t,v in line)
  band='M'+'L'.join(f'{X(t):.0f} {Y(v):.1f}' for t,v in up)+'L'+'L'.join(f'{X(t):.0f} {Y(v):.1f}' for t,v in reversed(lo))+'Z'
  ev=e25.get(k) if k!='oth' else 100-sum(e25[j] for j in ['onp','alp','lnp','grn'])
  out[k]=dict(dots=dots,line=lp,band=band,now=round(line[-1][1],1),se=round(1.645*se,1),endY=round(Y(line[-1][1]),1),endX=round(X(line[-1][0]),1),elec=ev,elecY=round(Y(ev),1),n=len(pts))
for k in parties: print(k,out[k]['now'],'±',out[k]['se'],'elec',out[k]['elec'],'delta',round(out[k]['now']-out[k]['elec'],1),'n',out[k]['n'],'endY',out[k]['endY'],'len',len(out[k]['dots']))
print('last',last,len(P))
for e in d['events']:
  if e['major']: print(e['short'],round(X(day(e['date'])),1))
for m in range(5,22):
  y=2025+(m-1)//12; mo=(m-1)%12+1; print(dt.date(y,mo,1), round(X(dt.date(y,mo,1)),1))
json.dump(out,open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'outm.json'),'w'))
