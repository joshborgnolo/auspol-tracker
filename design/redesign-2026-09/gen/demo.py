import json, datetime as dt, collections
D=json.load(open('data/demographics.json'))['waves']; P=json.load(open('data/polls.json'))['polls']
day=dt.date.fromisoformat
def overall(w):
  best=None
  for p in P:
    if p['pollster'].split('/')[0].lower() in w['pollster'].lower() or w['pollster'].split('/')[0].lower() in p['pollster'].lower():
      dd=abs((day(p['date'])-day(w['date'])).days)
      if dd<=5 and p.get('onp') is not None and (best is None or dd<best[0]): best=(dd,p['onp'])
  return best and best[1]
amap={'18–34':'18–34','35–54':'35–54','35–49':'35–54','55+':'55+','50+':'55+'}
agg=collections.defaultdict(list); miss=0
for w in D:
  o=overall(w)
  if o is None: miss+=1; continue
  m=w['date'][:7]
  for g,v in w['dims'].get('age',{}).items():
    if g in amap and v.get('onp') is not None: agg[('age',amap[g],m)].append(v['onp']-o)
  for g,v in w['dims'].get('generation',{}).items():
    if g in ('Gen Z','Millennials','Gen X','Boomers') and v.get('onp') is not None: agg[('gen',g,m)].append(v['onp']-o)
print('missing overall',miss)
out=collections.defaultdict(dict)
for (dim,g,m),xs in sorted(agg.items()):
  out[g][m]=round(sum(xs)/len(xs),1)
for g,d in out.items(): print(g, d)
print([ (w['pollster'],w['date'],sorted(w['dims'].get('age',{}).keys())) for w in D if 'age' in w['dims']][:3], [ (w['pollster'],sorted(w['dims']['age'].keys())) for w in D if w['pollster']=='DemosAU' and 'age' in w['dims']][:1])
mo=collections.defaultdict(list)
for p in P:
  if p.get('onp') is not None: mo[p['date'][:7]].append(p['onp'])
allv={m:round(sum(v)/len(v),1) for m,v in mo.items()}
months=[f'2025-{i:02d}' for i in range(7,13)]+[f'2026-{i:02d}' for i in range(1,10)]
print('all',[allv[m] for m in months])
PX=44; H=220; YM=40
def pts(g,ms,x0):
  return [(x0+PX*i, round(H-(allv[m]+out[g][m])/YM*H,1), round(allv[m]+out[g][m],1)) for i,m in enumerate(ms) if m in out[g]]
agem=months[:] ; genm=months[7:]
for g in ['18–34','35–54','55+']: 
  s=pts(g,agem,0); print(g,'M'+'L'.join(f'{x} {y}' for x,y,_ in s), s[-1])
print('allA','M'+'L'.join(f'{PX*i} {round(H-allv[m]/YM*H,1)}' for i,m in enumerate(agem)))
for g in ['Gen Z','Millennials','Gen X','Boomers']:
  s=pts(g,genm,0); print(g,'M'+'L'.join(f'{x} {y}' for x,y,_ in s), s[-1])
print('allG','M'+'L'.join(f'{PX*i} {round(H-allv[m]/YM*H,1)}' for i,m in enumerate(genm)))
