import json, sys
R="/Users/joshuaborgnolo/auspol tracker/"
lef=json.load(open(R+"data/flow-lef.json"))

def dy(s):
    y,m,d=map(int,s.split('-')); return y+(m-1)/12+(d-1)/365
FED={'2013':'2013-09-07','2016':'2016-07-02','2019':'2019-05-18','2022':'2022-05-21','2025':'2025-05-03',
     '1996':'1996-03-02','1998':'1998-10-03','2001':'2001-11-10','2004':'2004-10-09','2007':'2007-11-24','2010':'2010-08-21'}
# state estimates (site's model reads, state-flows-est.csv) -> share to Labor, and primary shares (state-flows.csv)
import csv
est={}; prim={}
for r in csv.DictReader(open(R+"data/state-flows-est.csv")):
    if r['est_flow_to_alp']: est[(r['jurisdiction'],r['year'],r['party'])]=float(r['est_flow_to_alp'])*100
for r in csv.DictReader(open(R+"data/state-flows.csv")):
    prim[(r['jurisdiction'],r['year'],r['party'])]=float(r['prim_share'] or 0)
SD={('wa','2013'):'2013-03-09',('wa','2017'):'2017-03-11',('wa','2021'):'2021-03-13',('wa','2025'):'2025-03-08',
    ('qld','2012'):'2012-03-24',('qld','2015'):'2015-01-31',('qld','2017'):'2017-11-25',('qld','2020'):'2020-10-31',('qld','2024'):'2024-10-26'}
def fedpts(years):
    out=[]
    for y in years:
        v=lef[y]
        for p in ('grn','onp','oth'):
            if p in v['f']: out.append(dict(j='fed',p=p,x=dy(FED[y]),v=v['f'][p]*100,sh=v['share'].get(p,0),lab='Federal '+y))
    return out
def statepts(keys):
    out=[]
    for (j,y) in keys:
        for p in ('grn','onp','oth'):
            if (j,y,p) in est: out.append(dict(j=j,p=p,x=dy(SD[(j,y)]),v=est[(j,y,p)],sh=prim.get((j,y,p),0),lab={'wa':'WA','qld':'Qld'}[j]+' '+y))
    return out

PN={'grn':'Greens','onp':'One Nation','oth':'Others'}
JN={'fed':'Federal','wa':'WA','qld':'Queensland'}
DASH={'fed':'','wa':'6 4','qld':'1.5 3.5'}

def chart(cid, pts, hidden, x0, x1, ticks, y0=20, y1=95, marks=(), title='', sub='', note=''):
    W,H,L,Rm,T,B=660,300,40,96,14,30
    X=lambda x: L+(x-x0)/(x1-x0)*(W-L-Rm)
    Y=lambda v: T+(y1-v)/(y1-y0)*(H-T-B)
    g=[]
    for v in range(int(y0//10*10+10), int(y1)+1, 10):
        g.append(f'<line x1="{L}" x2="{W-Rm}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" class="cg"/><text x="{L-6}" y="{Y(v)+4:.1f}" class="ct" text-anchor="end">{v}</text>')
    g.append(f'<line x1="{L}" x2="{W-Rm}" y1="{Y(50):.1f}" y2="{Y(50):.1f}" class="c50"/>')
    for t in ticks:
        g.append(f'<text x="{X(t):.1f}" y="{H-8}" class="ct" text-anchor="middle">{t}</text>')
    allp=pts+[dict(q,hid=1) for q in hidden]
    series={}
    for q in allp: series.setdefault((q['j'],q['p']),[]).append(q)
    ends=[]
    for (j,p),qs in series.items():
        qs.sort(key=lambda q:q['x'])
        vis=[q for q in qs if not q.get('hid')]
        if len(vis)>1:
            d=' '.join(f"{'M' if i==0 else 'L'}{X(q['x']):.1f},{Y(q['v']):.1f}" for i,q in enumerate(vis))
            g.append(f'<path d="{d}" class="cl" style="stroke:var(--{p})" stroke-dasharray="{DASH[j]}"/>')
        hid=[q for q in qs if q.get('hid')]
        if hid and vis:
            a,b=vis[-1],hid[0]
            g.append(f'<path d="M{X(a["x"]):.1f},{Y(a["v"]):.1f} L{X(b["x"]):.1f},{Y(b["v"]):.1f}" class="cl rv" style="stroke:var(--{p})"/>')
        for q in qs:
            small=q['sh']<2
            cls='cp'+(' rv' if q.get('hid') else '')
            fill='var(--surface, #fff)' if small else f'var(--{p})'
            g.append(f'<circle cx="{X(q["x"]):.1f}" cy="{Y(q["v"]):.1f}" r="{4.2 if j=="fed" else 3.4}" class="{cls}" style="stroke:var(--{p});fill:{fill}"><title>{q["lab"]}: {PN[p]} {q["v"]:.1f}% to Labor (primary {q["sh"]:.1f}%)</title></circle>')
            if q.get('hid'):
                g.append(f'<text x="{X(q["x"])+7:.1f}" y="{Y(q["v"])+4:.1f}" class="ct rv" style="fill:var(--{p}-text,var(--{p}))">{q["v"]:.1f}</text>')
    for m in marks:
        x,y,lab=X(m['x']),Y(m['v']),m['lab']
        if 'lo' in m: g.append(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{Y(m["lo"]):.1f}" y2="{Y(m["hi"]):.1f}" class="cx" stroke-dasharray="2 2"/>')
        g.append(f'<path d="M{x-5:.1f},{y-5:.1f}L{x+5:.1f},{y+5:.1f}M{x+5:.1f},{y-5:.1f}L{x-5:.1f},{y+5:.1f}" class="cx"/>')
        g.append(f'<text x="{x+9:.1f}" y="{y+4:.1f}" class="ct cxl">{lab}</text>')
    key=''.join(f'<span class="kk"><i style="background:var(--{p})"></i>{PN[p]}</span>' for p in ('grn','oth','onp'))
    key+=''.join(f'<span class="kk"><svg width="26" height="8"><line x1="0" x2="26" y1="4" y2="4" stroke="currentColor" stroke-width="2" stroke-dasharray="{DASH[j]}"/></svg>{JN[j]}</span>' for j in sorted({q["j"] for q in allp},key=['fed','wa','qld'].index))
    key+='<span class="kk"><svg width="10" height="10"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>Under 2% of the vote</span>'
    btn=f'<button class="rvb" type="button" aria-pressed="false" onclick="var f=this.closest(\'figure\');f.classList.toggle(\'on\');this.setAttribute(\'aria-pressed\',f.classList.contains(\'on\'));this.textContent=f.classList.contains(\'on\')?\'Hide the {hidden[0]["lab"]} flows\':\'Show the {hidden[0]["lab"]} flows\'">Show the {hidden[0]["lab"]} flows</button>' if hidden else ''
    return f'''<figure class="dr-fig" id="{cid}">
<div class="dr-ft">{title}</div><div class="dr-fs">{sub}</div>
<div class="dr-key">{key}</div>
<svg viewBox="0 0 {W} {H}" role="img" aria-label="{title}">{''.join(g)}</svg>
<div class="dr-fb">{btn}<span class="dr-fn">{note}</span></div>
</figure>'''

exec(open('/Users/joshuaborgnolo/auspol tracker/.build/flows-explained-redraft/chart5.py').read())
FY={int(k):dy(v) for k,v in FED.items()}
main=lineft('fig-main', fedpts(['1996','1998','2001','2004','2007','2010','2013','2016','2019','2022','2025']), 1995, 2026, [1996,1998,2001,2004,2007,2010,2013,2016,2019,2022,2025], 20, 90,
    'Greens preferences have hardened towards Labor at federal elections, and One Nation&rsquo;s towards the Coalition',
    '% share of each party&rsquo;s preferences reaching Labor against the Coalition. Hollow dots and dotted lines = the party won under 2% of the vote.',
    ('Stand-in for the live chart. 1996&ndash;2001 flows are read from two-candidate counts in Labor v Coalition seats; from 2004, from the AEC&rsquo;s two-party flows.',),
    'AEC')
effc=effectfig('fig-eff', [(FY[t], v) for t,v in [(int(t), -lef[str(p)]['backtest']['err']) for p,t in zip([1993,1996,1998,2001,2004,2007,2010,2013,2016,2019,2022],[1996,1998,2001,2004,2007,2010,2013,2016,2019,2022,2025])]], 1995, 2026, [1996,1998,2001,2004,2007,2010,2013,2016,2019,2022,2025],
    'Last-election flows have missed the two-party vote by less than half a point at seven of the last 11 elections',
    'Labor&rsquo;s 2PP against what the previous election&rsquo;s flows implied, given each election&rsquo;s actual primary votes, points',
    ('Uses the site&rsquo;s three-group flow table (Greens, One Nation, everyone else), including each election&rsquo;s small three-cornered-contest term. Kevin Bonham&rsquo;s party-by-party method, used on the last-election flows track-record page, gives the same picture with different individual years: 2022 +0.9 and 2025 &minus;0.3.',),
    'AEC')
exec(open('/Users/joshuaborgnolo/auspol tracker/.build/flows-explained-redraft/chart4.py').read())
c19=dotplot('fig-2019','2016','2019',[('wa','2017'),('qld','2017')],
    dict(v=40,lab='Newspoll&rsquo;s setting',tip='Newspoll estimated 40% of One Nation preferences to Labor (60% to the Coalition)'),
    'Before the 2019 federal election, recent state elections pointed to a weaker preference flow to Labor from One Nation',
    '% share of each party&rsquo;s preferences reaching Labor against the Coalition',
    ('Newspoll gave the Coalition 60% of One Nation preferences, which is 40% to Labor. Each group&rsquo;s effect is its change in flow times its share of the 2019 vote; the net leaves out 0.03 points from three-cornered contests. &ldquo;Coalition&rdquo; stands in for the LNP in Queensland.',),
    'AEC; WA Electoral Commission and Electoral Commission of Queensland (state flows as estimated by this site); The Australian')
c25=dotplot('fig-2025','2022','2025',[('qld','2024'),('wa','2025')],
    dict(v=29,lo=26,hi=32,lab='Newspoll&rsquo;s setting, inferred'),
    'Before the 2025 federal election, recent state elections pointed to a weaker preference flow to Labor from One Nation',
    '% share of each party&rsquo;s preferences reaching Labor against the Coalition',
    ('Newspoll did not publish its new One Nation estimate. The cross is inferred from its final poll, assuming 2022 flows for Greens and others; rounding leaves it &plusmn;3. Effects use 2025 vote shares; the net leaves out 0.04 points from three-cornered contests. &ldquo;Coalition&rdquo; stands in for the LNP in Queensland.',),
    'AEC; WA Electoral Commission and Electoral Commission of Queensland (state flows as estimated by this site); The Australian')

def sgn(v,d=1):
    s=f"{abs(v):.{d}f}"
    return ('+' if v>0.00001 else '&minus;' if v<-0.00001 else '')+s
def table(cap, head, rows, cls='', foot=None):
    th=''.join(f'<th scope="col"{" class=\"ex-l\"" if i==0 else ""}>{h}</th>' for i,h in enumerate(head))
    tr=''
    for r in rows:
        c=r.get('cls','')
        tr+=f'<tr class="{c}">'+''.join(f'<td{" class=\"ex-l\"" if i==0 else ""}>{v}</td>' for i,v in enumerate(r['v']))+'</tr>'
    return f'<div class="ex-twrap"><table class="ex-table {cls}"><caption>{cap}</caption><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'

# ---- current aggregate worked example (fig.prim on 4 Nov 2026: ALP/LNP/GRN/ONP/OTH)
A=dict(alp=26.4,lnp=23.1,grn=13.2,onp=26.1,oth=11.3)
F=dict(grn=.8819,onp=.2550,oth=.5455); FO=dict(lnp=.27,grn=.91,oth=.55); C3=0.072
cl=A['alp']+sum(A[k]*F[k] for k in F)+C3
on=A['alp']+sum(A[k]*FO[k] for k in FO)
def wrow(n,share,f,show=True):
    return {'v':[n,f'{share:.1f}',f if isinstance(f,str) else f'&times; {f:.3f}'.replace('0.','.') if f not in(1,0) else ('&times; 1' if f==1 else '&times; 0'),f'{share*(f if not isinstance(f,str) else 0):.2f}']}
wk=f'''<div class="dr-pair">
{table('Labor v Coalition', ['Voters','Primary','To Labor','2PP'], [
 {'v':['Labor','26.4','all','26.40']},
 {'v':['Greens','13.2','88.2%',f"{13.2*.8819:.2f}"]},
 {'v':['One Nation','26.1','25.5%',f"{26.1*.2550:.2f}"]},
 {'v':['Others','11.3','54.5%',f"{11.3*.5455:.2f}"]},
 {'v':['Coalition','23.1','none','0.00']},
 {'v':['Three-cornered','','','+0.07']},
 {'v':['Labor&rsquo;s 2PP','','',f'{cl:.1f}'],'cls':'ex-sum'}],'ex-tight')}
{table('Labor v One Nation', ['Voters','Primary','To Labor','2PP'], [
 {'v':['Labor','26.4','all','26.40']},
 {'v':['Coalition','23.1','27%',f"{23.1*.27:.2f}"]},
 {'v':['Greens','13.2','91%',f"{13.2*.91:.2f}"]},
 {'v':['Others','11.3','55%',f"{11.3*.55:.2f}"]},
 {'v':['One Nation','26.1','none','0.00']},
 {'v':['&nbsp;','','','']},
 {'v':['Labor&rsquo;s 2PP','','',f'{on:.1f}'],'cls':'ex-sum'}],'ex-tight')}
</div>
<p class="ex-tnote">Primary votes are the site&rsquo;s aggregate on 4 November 2026. Each group&rsquo;s primary is multiplied by the share of its preferences that reaches Labor, and the products are added up. The classic contest adds 0.07 for seats where Liberal and National candidates both ran and swapped preferences. <span class="chk" title="Not rounding: these primaries are exactly what the site stores, and the One Nation headline is computed from them (50.9, matches). The classic headline (51.0) is built another way: it averages each poll&rsquo;s own implied 2PP, with its own house effects, which runs about a tenth above. Your call: keep 50.9 with this note, or quote 51.0 and call the table illustrative.">The Labor v Coalition headline reads 51.0 because it averages each poll&rsquo;s own implied figure rather than running the averaged primaries through the table; the two routes differ by about a tenth.</span></p>'''

# ---- 2004
ACT=47.26
P04=[('Newspoll','7 Oct',45,39,7,1,8,50.0,1.91),
     ('ACNielsen','7 Oct',49,37,7,1,6,46.0,-1.23),
     ('Roy Morgan','8 Oct',45.5,38.5,9.5,1,5.5,51.0,1.85),
     ('Galaxy','4 Oct',46,39,7,None,8,48.0,1.15)]
def f1(v): return '&ndash;' if v is None else (f'{v:g}' if v==int(v) else f'{v:.1f}')
def spread(i): 
    xs=[r[i] for r in P04 if r[i] is not None]; return f'{max(xs)-min(xs):g}'
t04a=table('Final polls of the 2004 campaign: primary votes, per cent.', ['Pollster','Coalition','Labor','Greens','One Nation','Others'],
  [{'v':[f'{n} <span class="dt">{d}</span>'+(' <span class="dt">used last-election flows</span>' if n=='Galaxy' else ''),f1(c),f1(a),f1(g),f1(o),f1(t)]} for n,d,c,a,g,o,t,*_ in P04]+
  [{'v':['Spread (highest &minus; lowest)',spread(2),spread(3),spread(4),spread(5),spread(6)],'cls':'dr-spread'},
   {'v':['Election, 9 Oct','46.7','37.6','7.2','1.2','7.3'],'cls':'b'}])
def flowimp(r):
    n,d,c,a,g,o,t,pub,_=r; minor=g+(o or 0)+t
    return (pub-a)/minor*100
fl=[flowimp(r) for r in P04]
t04b=table('Their published two-party figures, and the share of minor-party preferences each figure implies reached Labor.', ['Pollster','Labor 2PP','Minor-party preferences to Labor'],
  [{'v':[n,f'{pub:.1f}',f'{flowimp(r):.0f}%']} for r in P04 for n,d,c,a,g,o,t,pub,_ in [r]]+
  [{'v':['Spread (highest &minus; lowest)',f'{max(r[7] for r in P04)-min(r[7] for r in P04):.1f}',f'{max(fl)-min(fl):.0f} pts'],'cls':'dr-spread'},
   {'v':['Election','47.3','61%'],'cls':'b'}])
rows=[]
for n,d,c,a,g,o,t,pub,imp in P04:
    rows.append({'v':[n,sgn(pub-ACT),sgn(imp)]})
pm=sum(r[7]-ACT for r in P04)/4; im=sum(r[8] for r in P04)/4
pa=sum(abs(r[7]-ACT) for r in P04)/4; ia=sum(abs(r[8]) for r in P04)/4
rows+= [{'v':['Average',sgn(pm),sgn(im)],'cls':'ex-sum'},{'v':['Average miss, either direction',f'{pa:.1f}',f'{ia:.1f}'],'cls':'dr-spread'}]
t04c=table('Two-party error against the result (Labor 47.3), points. Positive = too high for Labor. The implied figure runs each poll&rsquo;s primaries through the 2001 flows.', ['Pollster','Published 2PP','Implied 2PP'], rows)

tyg=table('YouGov&rsquo;s final poll of 2025 (fieldwork to 1 May), primary votes, per cent.', ['','Labor','Coalition','Greens','One Nation','Others'],
  [{'v':['YouGov','31.1','31.4','14.6','8.5','14.4']},{'v':['Election, 3 May','34.6','31.8','12.2','6.4','15.0'],'cls':'b'}])

ton=table('One Nation preferences at federal elections, against Labor and the Coalition, per cent.', ['Election','To Labor','To the Coalition','Change to the Coalition'],
  [{'v':['2016','49.5','50.5','']},{'v':['2019','34.8','65.2','+14.7'],'cls':'b'},{'v':['2022','35.7','64.3','&minus;0.9']},{'v':['2025','25.5','74.5','+10.2'],'cls':'b'}])

# 2025 decomposition (2025 primaries, 2022 -> 2025 flows)
L22,L25=lef['2022'],lef['2025']
x=L25['share']['onp']*(L25['f']['onp']-L22['f']['onp'])
y=sum(L25['share'][k]*(L25['f'][k]-L22['f'][k]) for k in ('grn','oth'))

tsh=f'''<div class="ex-twrap"><table class="ex-table dr-why"><thead><tr><th class="ex-l" scope="col">Election</th><th class="ex-l" scope="col">Voters</th><th scope="col">Shift<sup class="fn"><a href="#fn5" id="r5">5</a></sup></th><th class="ex-l" scope="col">Explanation</th></tr></thead><tbody>
<tr><td class="ex-l" rowspan="2">2013</td><td class="ex-l">Greens</td><td>+4.2</td><td class="ex-l">Labor had governed with the Greens&rsquo; support since 2010, and Greens voters disliked Tony Abbott&rsquo;s Coalition.</td></tr>
<tr><td class="ex-l">Others</td><td>+5.1</td><td class="ex-l">Minor parties that had also run in 2010 sent Labor about 6 points more than before. New parties, chiefly Clive Palmer&rsquo;s Palmer United, split their preferences fairly evenly, and the independents shifted away from rural conservatives.</td></tr>
<tr><td class="ex-l" rowspan="2">2019</td><td class="ex-l">One Nation</td><td>&minus;14.7</td><td class="ex-l">In 2016 One Nation was a small, Queensland-first protest brand on 1.3% of the vote, and its preferences split almost evenly (49.5% to Labor). By 2019 it was a settled right-wing party drawing conservative-leaning voters, and, as at the 2017 WA and Queensland elections, its how-to-vote cards mostly put the Coalition ahead of Labor.</td></tr>
<tr><td class="ex-l">Others</td><td>&minus;3.1</td><td class="ex-l">Clive Palmer spent about $89 million launching the United Australia Party, which won 3.4% of the vote, campaigned against Labor and swapped preferences with the Coalition.</td></tr>
<tr><td class="ex-l" rowspan="2">2022</td><td class="ex-l">Greens</td><td>+3.5</td><td class="ex-l">The mirror of 2013: an unpopular Coalition government under Scott Morrison, and Greens voters keener than usual to remove it.</td></tr>
<tr><td class="ex-l">Others</td><td>+3.9</td><td class="ex-l">More of the &lsquo;others&rsquo; vote went to independents, including the teals, whose voters lean to Labor over the Coalition, and the same anti-government mood reached them.</td></tr>
</tbody></table></div>'''

exec(open('/Users/joshuaborgnolo/auspol tracker/.build/flows-explained-redraft/tables.py').read())
data=dict(main=main,effc=effc,c19=c19,c25=c25,wk=wk,test=test,t04a=t04a,t04b=t04b,t04c=t04c,tyg=tyg,ton=ton,tsh=tsh,
  x=f'{x:.1f}', y=f'{y:.1f}', cl=f'{cl:.1f}', on=f'{on:.1f}',
  dl=f"{L25['share']['alp']-A['alp']:.1f}", dc=f"{L25['share']['lnp']-A['lnp']:.1f}", don=f"{A['onp']-L25['share']['onp']:.1f}")
json.dump(data,open(sys.argv[1],'w'))
print({k:v for k,v in data.items() if len(v)<12}, [round(f,1) for f in fl], pm, im, pa, ia)
