import pandas as pd, numpy as np, json, sys
F=sys.argv[1]  # ADA AES integrated file 1967-2025 (.dta), licensed, not committed
df=pd.read_stata(F,columns=['aeswave','dcdvote','vthor','weight'],convert_categoricals=False)
VOTE={2:'alp',1:'lnp',3:'lnp',5:'grn',6:'onp',4:'oth',7:'oth',11:'oth',19:'oth',8:'oth'}
GOV={1990:'alp',1993:'alp',1996:'alp',1998:'lnp',2001:'lnp',2004:'lnp',2007:'lnp',2010:'alp',2013:'alp',2016:'lnp',2019:'lnp',2022:'lnp',2025:'alp'}
df=df[df.dcdvote.between(1,6)&df.vthor.isin(list(VOTE))].copy()
df['p']=df.vthor.map(VOTE); df['w']=df.weight.where(df.weight>0,1.0).fillna(1.0)
df['grp']=np.where(df.dcdvote>=5,'late',np.where(df.dcdvote>=3,'camp','early'))
P=['alp','lnp','grn','onp','oth']
def shares(d):
    w=d.w; tot=w.sum(); neff=tot**2/(w**2).sum()
    return {p:100*w[d.p==p].sum()/tot for p in P}, neff, tot
rows=[]
for y,d in df.groupby('aeswave'):
    y=int(y)
    late,nl,wl=shares(d[d.grp=='late']); dec,nd,wd=shares(d[d.grp!='late'])
    lshare=100*wl/(wl+wd)
    gov=GOV[y]; opp='lnp' if gov=='alp' else 'alp'
    r={'year':y,'late_pct':lshare,'n_late':int((d.grp=='late').sum()),'neff_late':nl,'neff_dec':nd}
    for p in P: r['d_'+p]=late[p]-dec[p]
    r['d_gov']=late[gov]-dec[gov]; r['d_opp']=late[opp]-dec[opp]
    r['d_major']=r['d_alp']+r['d_lnp']; r['d_govmargin']=r['d_gov']-r['d_opp']
    # SE of difference in a share, per party, approx
    for k,(a,b) in {'gov':(late[gov],dec[gov]),'major':(late['alp']+late['lnp'],dec['alp']+dec['lnp'])}.items():
        r['se_'+k]=100*np.sqrt((a/100)*(1-a/100)/nl+(b/100)*(1-b/100)/nd)
    rows.append(r)
R=pd.DataFrame(rows).set_index('year')
pd.set_option('display.width',200)
print(R[['late_pct','n_late','d_alp','d_lnp','d_grn','d_onp','d_oth','d_gov','se_gov','d_opp','d_major','se_major']].round(1))
def pooled(col,secol=None):
    x=R[col]; m=x.mean(); sd=x.std(ddof=1); se=sd/np.sqrt(len(x)); t=m/se
    return m,sd,se,t
from math import erf,sqrt
for c in ['d_alp','d_lnp','d_grn','d_onp','d_oth','d_major','d_gov','d_opp','d_govmargin']:
    m,sd,se,t=pooled(c)
    # two-sided p from t with n-1 df approx via scipy if present
    try:
        from scipy import stats; p=2*stats.t.sf(abs(t),len(R)-1)
    except Exception: p=float('nan')
    print(f'{c:12s} mean {m:+.1f}  between-election sd {sd:.1f}  se {se:.1f}  t {t:+.2f}  p {p:.3f}')
# mean sampling SE vs observed SD for gov
print('mean within-wave SE gov',R.se_gov.mean().round(2),' major',R.se_major.mean().round(2))
R.round(3).to_csv(__file__.rsplit('/',1)[0]+'/late-deciders.csv')
