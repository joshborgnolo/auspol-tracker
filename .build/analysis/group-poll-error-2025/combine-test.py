#!/usr/bin/env python3
"""combine-test.py: should the polls and the AES be combined, and with what weights? (2026-11-10)

Reads out/group-error.json (group-error.mjs). Part 1: on the cells the count settles (state and AEC region
class gaps, 2025) the typical miss of the pooled polls, the AES, their plain mean, the sampling-weighted mean
and the best fixed weight, with the correlation of the two instruments' errors. Part 2: each instrument's
error beyond sampling on those cells, the polls-v-AES disagreement beyond sampling on the demographic cells,
and the weights the site's rule (1 / (sampling variance + instrument error^2)) gives the polls.
gen-data's DEMO_VOTE uses the result: DEMO_INSTR = 1.5. backtest-2013-22.py repeats part 1 at four earlier
elections.

Run from the repo root:
  python3 .build/analysis/group-poll-error-2025/combine-test.py > .build/analysis/group-poll-error-2025/out/combine-test.txt
"""
import json, math, os, random, sys
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out", "group-error.json")
d = json.load(open(SRC))
P = ["alp","lnp","grn","onp","oth"]
cells = []
for r in d["rows"]:
    if r["dim"] not in ("state","region"): continue
    for p in P:
        po, ae, ref = (r.get("pooled") or {}).get(p), (r.get("aes") or {}).get(p), r["ref"].get(p)
        if not po or not ae or ref is None: continue
        cells.append(dict(dim=r["dim"], scope=r["scope"], p=p, truth=ref["gap"], poll=po["gap"], pv=po["v"], aes=ae["gap"], av=ae["v"]))
print(len(cells), "cells with truth, polls and AES")
def rmse(xs): return math.sqrt(sum(x*x for x in xs)/len(xs))
def mae(xs): return sum(abs(x) for x in xs)/len(xs)
def report(sel, label):
    cs = [c for c in cells if sel(c)]
    ep = [c["poll"]-c["truth"] for c in cs]
    ea = [c["aes"]-c["truth"] for c in cs]
    em = [(c["poll"]+c["aes"])/2-c["truth"] for c in cs]
    # inverse-variance (sampling) weights
    ew = [ (c["poll"]/c["pv"]+c["aes"]/c["av"])/(1/c["pv"]+1/c["av"]) - c["truth"] for c in cs]
    # correlation of the two instruments' errors
    mp, ma = sum(ep)/len(ep), sum(ea)/len(ea)
    cov = sum((x-mp)*(y-ma) for x,y in zip(ep,ea))/len(ep)
    r = cov/math.sqrt(sum((x-mp)**2 for x in ep)/len(ep)*sum((y-ma)**2 for y in ea)/len(ea))
    wp = sum(1/c["pv"]/(1/c["pv"]+1/c["av"]) for c in cs)/len(cs)
    # best fixed weight on polls (in-sample)
    best = min(((rmse([w*c["poll"]+(1-w)*c["aes"]-c["truth"] for c in cs]), w) for w in [i/20 for i in range(21)]))
    # predicted sampling-only rmse
    sp = math.sqrt(sum(c["pv"] for c in cs)/len(cs)); sa = math.sqrt(sum(c["av"] for c in cs)/len(cs))
    print(f"{label:34s} n={len(cs):2d}  RMSE polls {rmse(ep):.2f} (sampling {sp:.2f})  AES {rmse(ea):.2f} (sampling {sa:.2f})  mean {rmse(em):.2f}  inv-var {rmse(ew):.2f} (polls wt {wp:.2f})  best w={best[1]:.2f}: {best[0]:.2f}  r(err) {r:+.2f}")
    return cs
report(lambda c: True, "all truth cells")
report(lambda c: c["dim"]=="state", "states (5 houses pooled)")
report(lambda c: c["dim"]=="region", "region class (RedBridge only)")
report(lambda c: c["dim"]=="state" and c["scope"]!="SA", "states ex SA")
for p in P: report(lambda c,p=p: c["p"]==p, "party "+p)
# bootstrap: is mean better than each?
random.seed(1)
cs = cells; B=4000; wins_p=wins_a=0
for _ in range(B):
    s=[random.choice(cs) for _ in cs]
    rp=rmse([c["poll"]-c["truth"] for c in s]); ra=rmse([c["aes"]-c["truth"] for c in s]); rm=rmse([(c["poll"]+c["aes"])/2-c["truth"] for c in s])
    wins_p+= rm<rp; wins_a+= rm<ra
print(f"bootstrap over cells: mean beats polls in {wins_p/B:.0%}, beats AES in {wins_a/B:.0%}")
# single houses v AES v average, states
for h in ["Newspoll","YouGov","Resolve","DemosAU","RedBridge"]:
    e1=[];e2=[];e3=[]
    for r in d["rows"]:
        if r["dim"]!="state": continue
        f=(r["houses"].get(h) or {}).get("fin")
        if not f: continue
        for p in P:
            if not f.get(p) or not r["aes"].get(p): continue
            t=r["ref"][p]["gap"]; e1.append(f[p]["gap"]-t); e2.append(r["aes"][p]["gap"]-t); e3.append((f[p]["gap"]+r["aes"][p]["gap"])/2-t)
    if e1: print(f"  {h:10s} states n={len(e1):2d}  house {rmse(e1):.2f}  AES {rmse(e2):.2f}  mean {rmse(e3):.2f}")
print()
def rms(xs): return math.sqrt(sum(x*x for x in xs)/len(xs))
T=[];D=[]
for r in d["rows"]:
    for p in P:
        po, ae = (r.get("pooled") or {}).get(p), (r.get("aes") or {}).get(p)
        if not po or not ae: continue
        c=dict(dim=r["dim"],scope=r["scope"],p=p,poll=po["gap"],pv=po["v"],aes=ae["gap"],av=ae["v"],truth=r["ref"][p]["gap"])
        (T if r["dim"] in("state","region") else D).append(c)
# excess (non-sampling) error per instrument on truth cells
ep=[c["poll"]-c["truth"] for c in T]; ea=[c["aes"]-c["truth"] for c in T]
tp2=rms(ep)**2-sum(c["pv"] for c in T)/len(T); ta2=rms(ea)**2-sum(c["av"] for c in T)/len(T)
print(f"truth cells n={len(T)}: non-sampling error  polls {math.sqrt(max(tp2,0)):.2f}  AES {math.sqrt(max(ta2,0)):.2f}")
def excess(cs,label):
    dd=[c["poll"]-c["aes"] for c in cs]
    samp=sum(c["pv"]+c["av"] for c in cs)/len(cs)
    ex=rms(dd)**2-samp
    print(f"{label:22s} n={len(cs):3d}  RMS polls−AES {rms(dd):.2f}  sampling alone {math.sqrt(samp):.2f}  excess {math.sqrt(max(ex,0)):.2f}  (per instrument if shared equally {math.sqrt(max(ex,0)/2):.2f})")
    return max(ex,0)/2
excess(T,"truth cells")
tau2=excess(D,"demographic cells")
for dim in ["gender","age","education","work","housing","income"]:
    excess([c for c in D if c["dim"]==dim],"  "+dim)
# weights polls would get under: sampling-only, and sampling + tau^2 each
for dim in ["gender","age","education","work","housing","income"]:
    cs=[c for c in D if c["dim"]==dim]
    w1=sum((1/c["pv"])/(1/c["pv"]+1/c["av"]) for c in cs)/len(cs)
    w2=sum((1/(c["pv"]+tau2))/(1/(c["pv"]+tau2)+1/(c["av"]+tau2)) for c in cs)/len(cs)
    se=sum(math.sqrt(1/(1/(c["pv"]+tau2)+1/(c["av"]+tau2))) for c in cs)/len(cs)
    print(f"  {dim:10s} polls' weight: sampling-only {w1:.2f}; with instrument error {w2:.2f}; combined 95% margin ±{1.96*se:.1f}")
# same weighting rule on truth cells, using the truth-cell tau
tt=(tp2+ta2)/2
e=[ (c["poll"]/(c["pv"]+tt)+c["aes"]/(c["av"]+tt))/(1/(c["pv"]+tt)+1/(c["av"]+tt))-c["truth"] for c in T]
print(f"truth cells: rule-weighted combination RMSE {rms(e):.2f} (plain mean 2.00, polls 2.26, AES 3.14)")
