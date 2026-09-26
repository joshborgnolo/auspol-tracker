import json, datetime as dt
import os
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
T=json.load(open(S + 'data/tpp_series.json'))
P=json.load(open(S + 'data/individualPolls.json'))
def dec(d):
    d=dt.date.fromisoformat(d); y0=dt.date(d.year,1,1)
    return d.year+(d-y0).days/365
X0,X1=dec('2025-05-01'),dec('2026-10-01')
def mk(W,top,bot,ppt):
    fx=lambda x:(x-X0)/(X1-X0)*W
    fy=lambda v:(top-v)*ppt
    return fx,fy
def f(v): return f'{v:.1f}'.rstrip('0').rstrip('.') if abs(v-round(v))>1e-9 else str(int(round(v)))
def line(pts,fx,fy): return 'M'+'L'.join(f'{f(fx(x))} {f(fy(y))}' for x,y in pts)
def band(pts,fx,fy): # pts: x,lo,hi
    up='L'.join(f'{f(fx(x))} {f(fy(h))}' for x,l,h in pts)
    dn='L'.join(f'{f(fx(x))} {f(fy(l))}' for x,l,h in reversed(pts))
    return 'M'+up+'L'+dn+'Z'
def dots(pts,fx,fy): return ''.join(f'M{f(fx(x))} {f(fy(y))}h0' for x,y in pts)
ev={'split1':'2025-05-28','joyce':'2025-12-08','bondi':'2025-12-14','split2':'2026-01-22','taylor':'2026-02-12','hormuz':'2026-03-02','budget':'2026-05-12'}
ticks={'Jul 2025':'2025-07-01','Oct':'2025-10-01','Jan 2026':'2026-01-01','Apr':'2026-04-01','Jul':'2026-07-01'}
elec=T['synth2pp'][0]; assert elec.get('election')
on=[(d['x'],d['a']) for d in T['synthOn']]
onb=[(d['x'],d['a']-d['ci95'],d['a']+d['ci95']) for d in T['synthOn']]
co=[(d['x'],d['alp']) for d in T['synth2pp']]
cob=[(d['x'],d['alp']-d['ci95'],d['alp']+d['ci95']) for d in T['synth2pp'] if not d.get('election')]
pubon=[(d['x'],d['a']) for d in T['alt2pp']['alp_on']]
pubco=[(d['x'],d['alp']) for d in T['agg2pp']]
fsb=[(d['x'],d['lo'],d['hi']) for d in T['flowSens']]
don=[(p['x'],p['alpOnImp']) for p in P if p.get('alpOnImp') is not None]
dco=[(p['x'],p['alpImp']) for p in P if p.get('alpImp') is not None]
dpub=[(p['x'],p['tppAlt']['alp']) for p in P if p.get('tppAlt') and p['tppAlt'].get('alp') is not None]
dpubc=[(p['x'],p['alp']) for p in P if p.get('alp') is not None]
for nm,a in [('don',don),('dco',dco),('dpub',dpub),('dpubc',dpubc)]:
    ys=[y for x,y in a]; print(nm,len(a),min(ys),max(ys))
print('onband',min(l for x,l,h in onb),max(h for x,l,h in onb),'cob',min(l for x,l,h in cob),max(h for x,l,h in cob),'fs',max(h for x,l,h in fsb))
out={}
for key,W,top,bot,ppt in [('d',1010,66,45,14),('p',320,66,45,10)]:
    fx,fy=mk(W,top,bot,ppt)
    o=dict(W=W,H=(top-bot)*ppt)
    o['on']=line(on,fx,fy); o['onb']=band(onb,fx,fy); o['co']=line(co,fx,fy); o['cob']=band(cob,fx,fy)
    o['pubon']=line(pubon,fx,fy); o['pubco']=line(pubco,fx,fy); o['fsb']=band(fsb,fx,fy)
    o['don']=dots(don,fx,fy); o['dco']=dots(dco,fx,fy); o['dpub']=dots(dpub,fx,fy); o['dpubc']=dots(dpubc,fx,fy)
    o['on_end']=[round(fx(on[-1][0]),1),round(fy(on[-1][1]),1)]
    o['co_end']=[round(fx(co[-1][0]),1),round(fy(co[-1][1]),1)]
    o['pubon_end']=[round(fx(pubon[-1][0]),1),round(fy(pubon[-1][1]),1)]
    o['pubco_end']=[round(fx(pubco[-1][0]),1),round(fy(pubco[-1][1]),1)]
    o['fs_end']=[round(fx(fsb[-1][0]),1),round(fy(fsb[-1][2]),1)]
    o['elec']=[round(fx(elec['x']),1),round(fy(elec['alp']),1)]
    o['on_start']=[round(fx(on[0][0]),1),round(fy(on[0][1]),1)]
    o['ev']={k:round(fx(dec(v)),1) for k,v in ev.items()}
    o['ticks']={k:round(fx(dec(v)),1) for k,v in ticks.items()}
    o['y']={v:round(fy(v),1) for v in (45,50,55,60,65,66)}
    # month x for Feb/Jul 2026
    o['mx']={d['ym']:round(fx(d['x']),1) for d in T['synthOn']}
    out[key]=o
json.dump(out,open(S + 'gen/geom.json','w'),indent=0)
for k in out: print(k,{a:out[k][a] for a in ('on_end','co_end','pubon_end','pubco_end','fs_end','elec','on_start','ev','ticks','y')})
print('dlen',len(out['d']['don']),len(out['d']['dpub']))
