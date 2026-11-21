# ---- FT-style tables, same system as the charts
PCOL={'Labor':'alp','Coalition':'lnp','Greens':'grn','One Nation':'onp','Others':'oth'}
def pname(s):
    k=PCOL.get(s); return f'<span style="color:var(--{k}-text,var(--{k}))">{s}</span>' if k else s
def mbar(v, scale, fmt=None, invert=False):
    # diverging mini bar: + = towards Labor (red), - = towards Coalition (blue); invert flips colour meaning
    lab=fmt if fmt is not None else sgn(v+(1e-9 if v>0 else -1e-9))
    pos=(v>0)!=invert
    col='var(--alp)' if pos else 'var(--lnp)'
    w=min(abs(v)/scale*50,50)
    side='left' if v>=0 else 'right'
    return f'<span class="tb"><i style="{side}:50%;width:{w:.1f}%;background:{col}"></i></span><span class="tv">{lab}</span>'
def ftable(title, sub, head, rows, foot=None, cls='', pair=None):
    def tab(head, rows, cap=None):
        th=''.join(f'<th scope="col" class="{"l" if i==0 else ""}">{pname(h)}</th>' for i,h in enumerate(head))
        tr=''
        for r in rows:
            cells=''.join(f'<td class="{"l" if i==0 else ""}">{(pname(v) if i==0 and r.get("party") else v)}</td>' for i,v in enumerate(r['v']))
            tr+=f'<tr class="{r.get("cls","")}">{cells}</tr>'
        capt=f'<div class="ft-pt">{cap}</div>' if cap else ''
        return f'<div class="ft-twrap">{capt}<table class="ft-tab {cls}"><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'
    body=(f'<div class="ft-tpair">{tab(*pair[0])}{tab(*pair[1])}</div>' if pair else tab(head, rows))
    f=f'<figcaption class="ft-f">{foot}</figcaption>' if foot else ''
    return f'<figure class="ft ftt"><div class="ft-rule"></div><div class="ft-t">{title}</div><div class="ft-s">{sub}</div>{body}{f}</figure>'

test=ftable('The site&rsquo;s preference-flow settings for each contest',
  '% share of each group&rsquo;s preferences reaching Labor. The Labor v One Nation settings are estimates; &plusmn; is how far each could plausibly be off.',
  ['Contest','Coalition','One Nation','Greens','Others'],
  [{'v':['Labor v Coalition <span class="dt">2025 election flows</span>','&mdash;','25.5','88.2','54.5']},
   {'v':['Labor v One Nation <span class="dt">estimate</span>','27 <span class="dt">&plusmn;4</span>','&mdash;','91 <span class="dt">&plusmn;2.5</span>','55 <span class="dt">&plusmn;4</span>']}])

def wtab(rows,total):
    return [{'v':r,'party':True,'cls':('spacer' if r[0]=='&nbsp;' else '')} for r in rows]+[{'v':['Labor&rsquo;s 2PP','','',total],'cls':'tot'}]
cls_,ons_=f'{cl:.1f}',f'{on:.1f}'
wk=ftable(f'On today&rsquo;s primary votes, Labor leads both contests {cls_}&ndash;{100-float(cls_):.1f}' if cls_==ons_ else 'On today&rsquo;s primary votes, Labor leads both contests',
  '% first preferences (site aggregate, 4 November 2026) &times; each group&rsquo;s share of preferences to Labor',
  None,None,
  foot='Each group&rsquo;s primary is multiplied by the share of its preferences that reaches Labor, and the products are added up. The classic contest adds 0.07 for seats where Liberal and National candidates both ran and swapped preferences. <span class="chk" title="Not rounding: these primaries are exactly what the site stores, and the One Nation headline is computed from them (50.9, matches). The classic headline (51.0) is built another way: it averages each poll&rsquo;s own implied 2PP, with its own house effects, which runs about a tenth above. Your call: keep 50.9 with this note, or quote 51.0 and call the table illustrative.">The Labor v Coalition headline reads 51.0 because it averages each poll&rsquo;s own implied figure rather than running the averaged primaries through the table; the two routes differ by about a tenth.</span>',
  pair=[(['Labor v Coalition','Primary','To Labor','2PP'],
         wtab([['Labor','26.4','all','26.40'],['Greens','13.2','88.2%',f"{13.2*.8819:.2f}"],['One Nation','26.1','25.5%',f"{26.1*.2550:.2f}"],['Others','11.3','54.5%',f"{11.3*.5455:.2f}"],['Coalition','23.1','none','0.00'],['Three-cornered','','','+0.07']],cls_)),
        (['Labor v One Nation','Primary','To Labor','2PP'],
         wtab([['Labor','26.4','all','26.40'],['Coalition','23.1','27%',f"{23.1*.27:.2f}"],['Greens','13.2','91%',f"{13.2*.91:.2f}"],['Others','11.3','55%',f"{11.3*.55:.2f}"],['One Nation','26.1','none','0.00'],['&nbsp;','','','']],ons_))])

t04a=ftable('The final 2004 polls agreed on Labor&rsquo;s primary vote to within two points',
  '% first preferences in each pollster&rsquo;s final poll',
  ['Pollster','Coalition','Labor','Greens','One Nation','Others'],
  [{'v':[f'{n} <span class="dt">{d}</span>',f1(c),f1(a),f1(g),f1(o),f1(t)]} for n,d,c,a,g,o,t,*_ in P04]+
  [{'v':['Spread, highest &minus; lowest',spread(2),spread(3),spread(4),spread(5),spread(6)],'cls':'sub'},
   {'v':['Election <span class="dt">9 Oct</span>','46.7','37.6','7.2','1.2','7.3'],'cls':'res'}],
  foot='Galaxy used last-election flows for its two-party figure; the other three used respondent-allocated preferences.')
t04b=ftable('Yet their two-party figures for Labor ranged across five points',
  'Labor&rsquo;s 2PP, %, and the share of minor-party preferences each figure implies went to Labor',
  ['Pollster','Labor 2PP','Minor-party preferences to Labor'],
  [{'v':[n,f'{pub:.1f}',f'{flowimp(r):.0f}%']} for r in P04 for n,d,c,a,g,o,t,pub,_ in [r]]+
  [{'v':['Spread, highest &minus; lowest',f'{max(r[7] for r in P04)-min(r[7] for r in P04):.1f}',f'{max(fl)-min(fl):.0f} pts'],'cls':'sub'},
   {'v':['Election','47.3','61%'],'cls':'res'}])
erow=[{'v':[n,mbar(pub-ACT,4),mbar(imp,4)]} for n,d,c,a,g,o,t,pub,imp in P04]
erow+=[{'v':['Average',mbar(pm,4),mbar(im,4)],'cls':'tot'},{'v':['Average miss, either direction',f'{pa:.1f}',f'{ia:.1f}'],'cls':'sub'}]
t04c=ftable('Last-election flows would have beaten three of the four published figures',
  'Error against the result (Labor 47.3), Labor 2PP points; + = too high for Labor',
  ['Pollster','Published 2PP','Implied 2PP'], erow, cls='ft-bars',
  foot='Implied figures run each poll&rsquo;s own primaries through the 2001 election&rsquo;s flows.')
tyg=ftable('YouGov&rsquo;s final 2025 poll had Labor&rsquo;s primary vote 3.5 points too low',
  '% first preferences; fieldwork to 1 May',
  ['','Labor','Coalition','Greens','One Nation','Others'],
  [{'v':['YouGov','31.1','31.4','14.6','8.5','14.4']},{'v':['Election <span class="dt">3 May</span>','34.6','31.8','12.2','6.4','15.0'],'cls':'res'}])
ton=ftable('One Nation preferences swung towards the Coalition in 2019, and again in 2025',
  '% share of One Nation preferences at federal elections',
  ['Election','To Labor','To the Coalition','Change'],
  [{'v':['2016','49.5','50.5','']},{'v':['2019','34.8','65.2',mbar(-14.7,15,'+14.7 to the Coalition')]},{'v':['2022','35.7','64.3',mbar(0.9,15,'+0.9 to Labor')]},{'v':['2025','25.5','74.5',mbar(-10.2,15,'+10.2 to the Coalition')]}],
  cls='ft-bars')
SH=[('2013','Greens',4.2,'Labor had governed with the Greens&rsquo; support since 2010, and Greens voters disliked Tony Abbott&rsquo;s Coalition.'),
    ('','Others',5.1,'Minor parties that had also run in 2010 sent Labor about 6 points more than before. New parties, chiefly Clive Palmer&rsquo;s Palmer United, split their preferences fairly evenly, and the independents shifted away from rural conservatives.'),
    ('2019','One Nation',-14.7,'In 2016 One Nation was a small, Queensland-first protest brand on 1.3% of the vote, and its preferences split almost evenly (49.5% to Labor). By 2019 it was a settled right-wing party drawing conservative-leaning voters, and, as at the 2017 WA and Queensland elections, its how-to-vote cards mostly put the Coalition ahead of Labor.'),
    ('','Others',-3.1,'Clive Palmer spent about $89 million launching the United Australia Party, which won 3.4% of the vote, campaigned against Labor and swapped preferences with the Coalition.'),
    ('2022','Greens',3.5,'The mirror of 2013: an unpopular Coalition government under Scott Morrison, and Greens voters keener than usual to remove it.'),
    ('','Others',3.9,'More of the &lsquo;others&rsquo; vote went to independents, including the teals, whose voters lean to Labor over the Coalition, and the same anti-government mood reached them.')]
tr=''
for yr,grp,v,why in SH:
    k=PCOL[grp]
    tr+=(f'<tr class="{"grp" if yr else ""}"><td class="l yr">{yr}</td><td class="l"><span style="color:var(--{k}-text,var(--{k}))">{grp}</span></td>'
         f'<td>{mbar(v,15)}</td><td class="l why">{why}</td></tr>')
tsh=(f'<figure class="ft ftt"><div class="ft-rule"></div><div class="ft-t">Greens and others drove the 2013 and 2022 misses; One Nation and Palmer drove 2019</div>'
     f'<div class="ft-s">Change in the share of each group&rsquo;s preferences reaching Labor, points</div>'
     f'<div class="ft-twrap"><table class="ft-tab ft-bars ft-why"><thead><tr><th class="l" scope="col">Election</th><th class="l" scope="col">Voters</th><th scope="col">Shift<sup class="fn"><a href="#fn5" id="r5">5</a></sup></th><th class="l" scope="col">Explanation</th></tr></thead><tbody>{tr}</tbody></table></div></figure>')
