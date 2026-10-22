"""bonham-party-flows.py - the party-level flow tables Kevin Bonham's
last-election-preferences test runs on, for bonham-lef-track-record.mjs's
"Bonham's rule" variant.

His rule ("Wonk Central: The Track Record Of Last-Election Preferences",
kevinbonham.blogspot.com/2015/09/wonk-central-track-record-of-last.html):
a pollster polls Labor, the Coalition and every minor party that polled at
least 4% at the previous election (the Democrats kept for 1996 at 3.75%),
and reads each through its own last-election flow; every other non-major
ballot - a debut party included (One Nation 1998, Palmer United 2013) - at
the last election's flow of everything untracked ("Others"). The repo's
FLOW_LEF tables instead itemise fixed buckets (Greens, One Nation, rest) and
lump 1987-93 into one flow, so they cannot run his rule; this script
re-reads every election by party code.

Sources, by era (all already cached under .build/aec-flow-src/):
  2004-2025  tpp-<year>: the AEC's two-party flow by state by party - every
             party code's own ballots, all seats (the TPP cut).
  1996-2001  tcp-<year>.json.gz: the statistics packs' Division Summary
             flows by party code, classic (Labor v Coalition) seats only;
             national primaries by code from hcands-<year>.txt (every
             candidate; V1_6's bucketed shares leave Greens WA out).
  1984-1993  (1993's primaries from hcands-1993.txt) no count by party exists: each code's flow is ESTIMATED over
             the classic seats by estimate-state-flows.py's two-class pile
             model (fitted on its full pool exactly as its main() does),
             replayed with origins tagged by code instead of by bucket. The
             same labelled replay on 1996-2001, where the packs did count by
             code, is the check printed as "dem_check". National primaries:
             polls.json's Labor/Coalition, the minor remainder split by code
             in the parsed first preferences (a few divisions per year fail
             parse-fed-history.py's checks and are left out of the split).
  1983       its counts stopped at a majority: no table.

anchor: official 2PP minus the table read on its own primaries, as in
aec-flow-history.py (non-classic seats, three-cornered leakage).

Writes .build/analysis/bonham-party-flows.json; takes ~3 min (the pool fit).
Usage (repo root): python3 .build/analysis/bonham-party-flows.py
"""
import collections
import gzip
import importlib.util
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.dirname(HERE)
ROOT = os.path.dirname(BUILD)
SRC = os.path.join(BUILD, "aec-flow-src")
OUT = os.path.join(HERE, "bonham-party-flows.json")


def _load(name, rel):
    spec = importlib.util.spec_from_file_location(name, os.path.join(BUILD, rel))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


es = _load("es", "estimate-state-flows.py")
ph = _load("ph", "parse-fed-history.py")
afh = _load("afh", "aec-flow-history.py")

ALP = {"ALP", "CLR"}
COAL = {"LP", "NP", "LNP", "LNQ", "CLP", "NAT", "LIB", "Lib", "NPA"}


def party(code):
    """party column by code: the four parties that ever cleared 4% besides
    the Greens, every Greens party as one, everything else by its own code
    (so it lands in Others unless it clears 4% itself)"""
    code = (code or "").strip()
    if code in ALP: return "alp"
    if code in COAL: return "lnp"
    if code in ("AD", "DEM"): return "dem"
    if code in ("ON", "HAN"): return "onp"
    if code == "PUP": return "pup"
    if code in ("UAPP", "UAP"): return "uap"
    if es.aec_bucket(code) == "grn": return "grn"
    return "x:" + (code or "IND")


def code_split(y):
    """{party: first preferences} over the divisions parse-fed-history.py reads"""
    tot = collections.Counter()
    for _, p, _ in ph.divisions_of(y):
        if p:
            for code, fp in p["cands"].values():
                tot[party(code)] += fp
    return tot


def hcands_share(y):
    """every candidate's first preferences, all divisions (the packs' HCANDS)"""
    import csv
    tot = collections.Counter()
    for r in csv.DictReader(open(os.path.join(SRC, f"hcands-{y}.txt"), encoding="latin-1"), delimiter=";"):
        tot[party(r["Party"])] += float(r["Vote"] or 0)
    F = sum(tot.values())
    return {k: 100 * v / F for k, v in tot.items()}


def national_from_split(alp, lnp, split):
    """polls.json's majors, the minor remainder shared out by the parsed split"""
    minor = 100 - alp - lnp
    mtot = sum(v for k, v in split.items() if k not in ("alp", "lnp"))
    share = {"alp": alp, "lnp": lnp}
    for k, v in split.items():
        if k not in ("alp", "lnp"):
            share[k] = share.get(k, 0) + minor * v / mtot
    return share


# ---- 2004-2025: counted, all seats -------------------------------------
def tpp_era(y):
    flows, first = afh.parse_tpp(y)
    b = collections.defaultdict(lambda: [0.0, 0.0])
    coal_tr = [0.0, 0.0]
    for code, (a, l) in flows.items():
        p = party(code)
        if p == "lnp": coal_tr[0] += a; coal_tr[1] += l; continue
        if p == "alp": continue
        b[p][0] += a; b[p][1] += l
    formal = first[0] + first[1] + sum(a + l for a, l in b.values()) + sum(coal_tr)
    tpp = 100 * (first[0] + sum(a for a, _ in b.values()) + coal_tr[0]) / formal
    share = {k: 100 * (u + v) / formal for k, (u, v) in b.items()}
    share["alp"] = 100 * first[0] / formal
    share["lnp"] = 100 * (first[1] + sum(coal_tr)) / formal
    return {"cut": "tpp", "votes": {k: list(v) for k, v in b.items()}, "share": share, "tpp": tpp}


# ---- 1996-2001: counted, classic seats ----------------------------------
def pack_era(y):
    ex = json.load(open(os.path.join(SRC, f"classic-{y}.json")))
    b = collections.defaultdict(lambda: [0.0, 0.0])
    for v in json.load(gzip.open(os.path.join(SRC, f"tcp-{y}.json.gz"))).values():
        pair = v["pair"]
        if not (any(p in ALP for p in pair) and any(p in COAL for p in pair)):
            continue
        ai = 0 if pair[0] in ALP else 1
        for code, t1, t2 in v["from"]:
            p = party(code)
            if p in ("alp", "lnp"):
                continue
            t = (t1, t2)
            b[p][0] += t[ai]; b[p][1] += t[1 - ai]
    # V1_6's shares are bucketed and leave Greens WA out of its Greens;
    # HCANDS has every candidate by code
    share = hcands_share(y)
    return {"cut": "classic-tcp", "votes": {k: list(v) for k, v in b.items()}, "share": share, "tpp": ex["tpp"]}


# ---- 1984-1993: the pile model, origins tagged by party -----------------
def fit_pool():
    """estimate-state-flows.py main()'s pool and fit, verbatim"""
    states = {}
    for f in (es.vic_elections, es.wa_elections, es.qld_elections, es.sa_elections, es.nt_elections, es.nsw_elections):
        states.update(f())
    evs, lam = {k: es.events(v) for k, v in states.items()}, {k: es.lam_of(v) for k, v in states.items()}
    fed = {y: es.fed_election(y) for y in es.FED_YEARS}
    for y in es.FED_YEARS:
        evs[("fed", y)] = es.events(fed[y][0])
        lam[("fed", y)] = es.lam_of(fed[y][0])
    hist = {y: es.hist_election(y) for y in es.HIST_YEARS}
    for y, (seats, _, _) in hist.items():
        evs[("fedh", y)] = es.events(seats)
        lam[("fedh", y)] = es.lam_of(seats)
    return es.fit(evs, lam), evs, fed, hist


def labelled_flows(y, seats, evs, model):
    """{party: [to Labor, to Coalition]} over the classic seats, each
    candidate's origin tagged by party code (parse-fed-history.py's codes)"""
    codes = {}
    for d, p, _ in ph.divisions_of(y):
        if p:
            codes[d] = {c: party(code) for c, (code, _) in p["cands"].items()}
    idx = collections.defaultdict(dict)
    for e in evs:
        idx[e["seat"]][e["x"]] = e
    agg = collections.defaultdict(lambda: [0.0, 0.0])
    for k, s in seats.items():
        if not es.classic(s) or k not in codes:
            continue
        piles = es.replay(s, model, idx[k], label=codes[k])
        a = next(c for c in s["final"] if s["cands"][c][0] == "alp")
        o = next(c for c in s["final"] if c != a)
        for lab in set(codes[k].values()) - {"alp", "lnp"}:
            agg[lab][0] += piles[a].get(lab, 0.0)
            agg[lab][1] += piles[o].get(lab, 0.0)
    return agg


def main():
    E = json.loads(subprocess.check_output(["git", "show", "origin/main:data/polls.json"], cwd=ROOT))["elections"]
    print("fitting the estimator's pool (estimate-state-flows.py) …", flush=True)
    params, evs, fed, hist = fit_pool()
    tables = {}
    for y in (1984, 1987, 1990, 1993):
        seats = hist[y][0]
        v = labelled_flows(y, seats, evs[("fedh", y)], params[("fedh", y)])
        e = E[f"e{y}"]
        share = hcands_share(y) if y == 1993 else national_from_split(e["alp"], e["lnp"], code_split(y))
        tables[y] = {"cut": "model", "votes": {k: list(x) for k, x in v.items()},
                     "share": share, "tpp": e["tpp_alp"]}
    for y in (1996, 1998, 2001):
        tables[y] = pack_era(y)
    for y in (2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025):
        tables[y] = tpp_era(y)
    # the check: the labelled model where the packs counted by code
    check = {}
    for y in (1996, 1998, 2001):
        v = labelled_flows(y, fed[y][0], evs[("fed", y)], params[("fed", y)])
        cnt = tables[y]["votes"].get("dem")
        if "dem" in v and cnt:
            check[y] = {"model": round(100 * v["dem"][0] / sum(v["dem"]), 2),
                        "counted": round(100 * cnt[0] / sum(cnt), 2)}
    out = {"source": "bonham-party-flows.py", "dem_check": check, "tables": {}}
    for y, t in tables.items():
        out["tables"][str(y)] = {"cut": t["cut"], "tpp": round(t["tpp"], 2),
                                 "share": {k: round(v, 3) for k, v in sorted(t["share"].items()) if v >= 0.0005},
                                 "votes": {k: [round(a), round(b)] for k, (a, b) in sorted(t["votes"].items())}}
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1)
        f.write("\n")
    print("wrote", os.path.relpath(OUT, ROOT), "dem_check", check)


if __name__ == "__main__":
    main()
