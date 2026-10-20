"""estimate-state-flows.py – each party's preference flow at the state
elections, estimated from the commissions' distributions of preferences,
with the federal back-test that sizes the estimates' error.

Why a model at all. A distribution of preferences reports where an excluded
candidate's whole pile went, ballots it had inherited from earlier
exclusions included, so it never says where one party's own voters ended
up. The parsers' first pass (parse-<jur>-state-flows.py, the flow_* columns
of data/state-flows.csv) splits every ballot in a pile in the pile's overall
proportions. Scored against the AEC's counted per-party flows at six
federal elections, that replay read the Greens 2-7 points too low and One
Nation and others up to 7 too high, because a Greens pile carries the
micro-party ballots it inherited and their split is blended into the Greens'.

The two-class pile model. At every exclusion the pile is two classes whose
sizes are known exactly: the excluded candidate's own first preferences
(they never move before it is excluded) and everything it inherited. Each
class gets its own split over the continuing candidates – a conditional
logit on the recipient's party type (Coalition the reference) and, for a
minor recipient, its log size – shared by every exclusion of that party at
that election and fitted by EM to the published counts (the classes are told
apart by how the own share varies from seat to seat). Each exclusion's
published split is then shared between the two classes by IPF, and the
replay follows own and inherited ballots separately to the final two.
The own-versus-inherited contrast is weakly identified in a small state, so
it is shrunk towards its ballot-weighted mean across every election in the
pool (the six federal elections 2010-2025 and every state election here),
with strength LAM0 per federal-size seat, scaled by the election's mean
seat size; each election keeps its own level.

Scored on the federal elections, the AEC's counted flows by division over
the same classic seats as the truth: see data/state-flows-backtest.json
("federal"), and "calibration" for the error at state sizes (one federal
election cut to N random seats and pooled with the other five, scored on
those seats) – the err90 column is that table's 90th-percentile error at the
election's classic-seat count. Queensland, where Antony Green tabulated the
ECQ's own counted flows, is the out-of-sample state check ("qld_check").

Inputs: the five state parsers' chain readers (each checks its chains
against the commission's final totals); the AEC House distributions of
preferences and two-candidate-preferred flows by division,
.build/aec-flow-src/{dop,tcpflow}-<year>.csv.gz (2025: atlas/data/aec-2025/
and data/aec-2025-tcp-flow-by-division.csv).
Outputs: data/state-flows-est.csv (jurisdiction, year, party, method,
est_alp_votes, est_coal_votes, est_flow_to_alp, err90, exhausted_share,
n_classic; method "counted" for NSW, whose ballot-level data gives exact
flows – the model's NSW reading is scored against them in nsw_check) and
data/state-flows-backtest.json.

Usage (repo root):
  python3 .build/estimate-state-flows.py               # fit, back-test, write (~2 min)
  python3 .build/estimate-state-flows.py --calibrate   # also redo the calibration (~30 min)
"""
import collections
import csv
import gzip
import importlib.util
import io
import json
import math
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, ".build")
OUT_CSV = os.path.join(ROOT, "data", "state-flows-est.csv")
OUT_JSON = os.path.join(ROOT, "data", "state-flows-backtest.json")

LAM0 = 3e4               # contrast shrinkage per federal-size seat (ballot units)
FED_SEAT = 104000.0      # mean formal ballots in a 2022/2025 federal seat
EM_ITERS = 200
FED_YEARS = (2010, 2013, 2016, 2019, 2022, 2025)
CAL_N = (40, 50, 85)     # calibration seat counts: SA/Vic 2022, WA, Qld
CAL_REPS = 6
# Antony Green's tabulation of the ECQ's counted flows, Labor v LNP finals
# (antonygreen.com.au/qld2024-preference-flows-and-vote-by-type-compared-to-2020/)
QLD_GREEN = {2020: {"grn": 80.1, "onp": 33.8}, 2024: {"grn": 80.7, "onp": 26.2}}
BUCKETS = ("grn", "onp", "oth")
K = 6
TYPES5 = ("alp", "grn", "onp", "oth", "exh")


# ------------------------------------------------------------------ loading
def _load(name, rel):
    spec = importlib.util.spec_from_file_location(name, os.path.join(BUILD, rel))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def coal(b):
    return "coal" if b in ("lib", "nat") else b


def seat(cands, steps):
    """{cands: {id: (bucket, fp)}, steps: [(excluded ids, {recipient: n}, exhausted)], final}"""
    alive = set(cands)
    for ex, _, _ in steps:
        alive -= set(ex)
    return {"cands": cands, "steps": steps, "final": sorted(alive)}


def vic_elections():
    pv = _load("pv", "parse-vic-state-flows.py")
    pv.ROOT = os.path.join(BUILD, "state-flow-src", "vic")
    out = {}
    for y in pv.YEARS:
        seats = {}
        for s in pv.seats_of(y):
            r = pv.parse_seat(y, s)
            if not r or not r.get("chain"):
                continue
            ch = r["chain"]
            cands = {nm: (coal(ch["party"][nm]), float(ch["fpv"].get(nm, 0) or 0)) for nm in ch["names"]}
            steps, alive, ok = [], set(cands), True
            for excl, adds in ch["transfers"]:
                if excl not in cands:
                    hit = [k for k in cands if k.startswith(excl) or excl.startswith(k)]
                    if len(hit) != 1:
                        ok = False
                        break
                    excl = hit[0]
                alive.discard(excl)
                steps.append(([excl], {k: float(v) for k, v in adds.items() if v and v > 0 and k in alive}, 0.0))
            if ok:
                seats[s] = seat(cands, steps)
        out[("vic", y)] = seats
    return out


def wa_elections():
    pw = _load("pw", "parse-wa-state-flows.py")
    out = {}
    for y in pw.YEARS:
        seats = {}
        for path in sorted(__import__("glob").glob(os.path.join(BUILD, "state-flow-src", "wa", f"sg{y}", "*.json"))):
            p = pw.parse_district(path)
            if not p:
                continue
            cands = {n: (coal(p["party"][n]), float(p["fpv"][n] or 0)) for n in p["names"]}
            steps, exh_prev = [], 0.0
            for lv in p["levels"]:
                if not lv.startswith("Distribution"):
                    continue
                cells = p["by_level"][lv]
                ex = [n for n in p["names"] if n in cells and cells[n][0] is not None and cells[n][0] < 0]
                rec = {n: float(cells[n][0]) for n in p["names"] if n in cells and n not in ex and (cells[n][0] or 0) > 0}
                exhs = [c[1] for c in cells.values() if c[1] is not None]
                exh = float(max(exhs)) if exhs else exh_prev
                steps.append((ex, rec, max(0.0, exh - exh_prev)))
                exh_prev = exh
            seats[os.path.basename(path)[:-5]] = seat(cands, steps)
        out[("wa", y)] = seats
    return out


def qld_elections():
    pq = _load("pq", "parse-qld-state-flows.py")
    pq.ROOT = os.path.join(BUILD, "state-flow-src", "qld")
    out = {}
    for y in pq.YEARS:
        seats = {}
        for name, p in pq.districts_of(y):
            if not p or not p["chain"]:
                continue
            cands = {bo: (coal(p["party"][bo]), float(p["fpv"].get(bo, 0))) for bo in p["order"]}
            steps = [([ex], {r: float(v) for r, v in moved.items() if v > 0 and r != ex}, float(exh))
                     for ex, exh, moved in p["chain"]]
            seats[name] = seat(cands, steps)
        out[("qld", y)] = seats
    return out


def sa_elections():
    ps = _load("ps", "parse-sa-state-flows.py")
    ps.SRC = os.path.join(BUILD, "state-flow-src", "sa")
    out = {}
    for y in ps.YEARS:
        seats = {}
        for name, p in ps.districts_of(y):
            if not p:
                continue
            cands = {n: (coal(p["affils"][n]), float(p["fpv"][n])) for n in p["names"]}
            steps = [([n for n, _ in st["neg"]], dict(st["pos"]), 0.0) for st in p["chain"]]
            seats[name] = seat(cands, steps)
            if p.get("party_ids"):
                seats[name]["ids"] = dict(p["party_ids"])
        out[("sa", y)] = seats
    return out


def nsw_elections():
    """NSW's full chains to the final two, re-counted from the ballots
    (parse-nsw-state-flows.py's committed chains.csv). NSW is optional-
    preferential, so each exclusion's exhausted ballots ride as a recipient.
    The model runs on NSW like any state, but the site draws NSW's COUNTS;
    the model's NSW reading is scored against them (nsw_check)."""
    pn = _load("pn", "parse-nsw-state-flows.py")
    pn.ROOT = os.path.join(BUILD, "state-flow-src", "nsw")
    out = {}
    for y in pn.YEARS:
        seats = {d: {"cands": {c: (coal(b), fp) for c, (b, fp) in p["cands"].items()},
                     "steps": p["steps"], "final": p["final"]} for d, p in pn.districts_of(y)}
        if seats:
            out[("nsw", y)] = seats
    return out


def nsw_counted():
    """{year: {bucket: [to Labor, to Coalition, exhausted]}} over NSW's
    classic districts, straight from the ballot counts (counts.csv)."""
    pn = _load("pn", "parse-nsw-state-flows.py")
    out = {}
    for y in pn.YEARS:
        path = os.path.join(BUILD, "state-flow-src", "nsw", str(y), "counts.csv")
        if not os.path.exists(path):
            continue
        rows = list(csv.DictReader(open(path)))
        party = {(r["district"], r["candidate"]): coal(pn.bucket_for(r["party"])) for r in rows}
        agg = {b: [0.0, 0.0, 0.0] for b in BUCKETS}
        for r in rows:
            f1, f2 = party[(r["district"], r["final1"])], party[(r["district"], r["final2"])]
            if {f1, f2} != {"alp", "coal"}:
                continue
            b = party[(r["district"], r["candidate"])]
            if b not in agg:
                continue
            a = 0 if f1 == "alp" else 1
            v = [float(r["to_final1"]), float(r["to_final2"])]
            agg[b][0] += v[a]
            agg[b][1] += v[1 - a]
            agg[b][2] += float(r["exhausted"])
        out[y] = agg
    return out


def nt_elections():
    pn = _load("pn", "parse-nt-state-flows.py")
    out = {}
    for y in pn.YEARS:
        seats = {}
        ydir = os.path.join(BUILD, "state-flow-src", "nt", str(y))
        for name in sorted(os.listdir(ydir)):
            if not name.endswith(".html"):
                continue
            p = pn.parse_division(os.path.join(ydir, name))
            if not p:
                continue
            cands = {c: (coal(pn.bucket_for(p["parties"][c])), float(p["fpv"].get(c, 0))) for c in p["cands"]}
            # NT 2016 was optional-preferential: its exhausted ballots ride as
            # a recipient of their own, so a flow is Labor's share of the
            # ballots that reached Labor or the CLP
            steps = [([n for n, _ in st["neg"]], dict(st["pos"]), float(st.get("exhaust", 0.0))) for st in p["chain"]]
            seats[name[:-5]] = seat(cands, steps)
        out[("nt", y)] = seats
    return out


def _aec_rows(path):
    raw = gzip.open(path, "rb").read() if path.endswith(".gz") else open(path, "rb").read()
    f = io.StringIO(raw.decode("utf-8-sig"))
    next(f)                                  # banner
    return csv.DictReader(f)


def aec_bucket(ab):
    ab = (ab or "").strip()
    if ab == "ALP":
        return "alp"
    if ab in ("LP", "NP", "LNP", "CLP", "NAT", "LIB"):
        return "coal"
    if ab in ("GRN", "GVIC", "TG", "GWA"):
        return "grn"
    if ab in ("ON", "HAN"):
        return "onp"
    return "oth"


def fed_paths(y):
    if y == 2025:
        return (os.path.join(ROOT, "atlas", "data", "aec-2025", "HouseDopByDivisionDownload-31496.csv"),
                os.path.join(ROOT, "data", "aec-2025-tcp-flow-by-division.csv"))
    return (os.path.join(BUILD, "aec-flow-src", f"dop-{y}.csv.gz"),
            os.path.join(BUILD, "aec-flow-src", f"tcpflow-{y}.csv.gz"))


def fed_election(y):
    dop, tcp = fed_paths(y)
    raw = collections.defaultdict(lambda: collections.defaultdict(dict))
    party = {}
    for r in _aec_rows(dop):
        key = r["DivisionNm"]
        cid = r.get("CandidateID") or r.get("CandidateId")
        party[(key, cid)] = r["PartyAb"]
        raw[key][int(r.get("CountNumber") or r.get("CountNum"))].setdefault(cid, {})[r["CalculationType"]] = float(r["CalculationValue"])
    seats = {}
    for key, counts in raw.items():
        cands = {cid: (aec_bucket(party[(key, cid)]), v["Preference Count"]) for cid, v in counts[0].items()}
        steps = []
        for k in sorted(counts)[1:]:
            tr = {cid: v.get("Transfer Count", 0.0) for cid, v in counts[k].items()}
            ex = [cid for cid, t in tr.items() if t < 0]
            if ex:
                steps.append((ex, {cid: t for cid, t in tr.items() if t > 0}, 0.0))
        seats[key] = seat(cands, steps)
    truth = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0]))
    for r in _aec_rows(tcp):
        if r["FromCandidateID"] == "0":
            continue
        fb, tb = aec_bucket(r["FromCandidatePartyAb"]), aec_bucket(r["ToCandidatePartyAb"])
        if fb in ("alp", "coal"):
            continue
        truth[r["DivisionNm"]][fb][0 if tb == "alp" else 1] += float(r["TransferCount"])
    return seats, truth


# ------------------------------------------------------------------ model
def xvec(t, size):
    v = [1.0 if t == u else 0.0 for u in TYPES5]
    v.append(size if t in ("grn", "onp", "oth") else 0.0)
    return v


def classic(s):
    return len(s["final"]) == 2 and {s["cands"][c][0] for c in s["final"]} == {"alp", "coal"}


def events(seats):
    out = []
    for key, s in seats.items():
        tot = {cid: fp for cid, (b, fp) in s["cands"].items()}
        formal = sum(tot.values()) or 1.0
        alive = set(tot)
        for excl, rec, exh in s["steps"]:
            if len(excl) == 1:
                x = excl[0]
                pile, own = tot[x], s["cands"][x][1]
                inh = max(0.0, pile - own)
                recs = [r for r in alive if r != x]
                X = [xvec(s["cands"][r][0], math.log(max(tot[r], 1.0) / formal)) for r in recs]
                n = [rec.get(r, 0.0) for r in recs]
                if exh > 0:
                    recs.append("__exh")
                    X.append(xvec("exh", 0.0))
                    n.append(exh)
                if own + inh > 0:
                    out.append({"seat": key, "x": x, "P": s["cands"][x][0], "own": own, "inh": inh,
                                "recs": recs, "X": X, "n": n})
            for x in excl:
                alive.discard(x)
            for r, v in rec.items():
                tot[r] = tot.get(r, 0.0) + v
            for x in excl:
                tot[x] = 0.0
    return out


def softmax(beta, X):
    u = [sum(b * xi for b, xi in zip(beta, x)) for x in X]
    m = max(u)
    e = [math.exp(v - m) for v in u]
    s = sum(e)
    return [v / s for v in e]


def solve(A, b):
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[p] = M[p], M[c]
        if abs(M[c][c]) < 1e-12:
            continue
        for r in range(n):
            if r != c and M[r][c]:
                f = M[r][c] / M[c][c]
                M[r] = [a - f * bb for a, bb in zip(M[r], M[c])]
    return [M[i][n] / M[i][i] if abs(M[i][i]) > 1e-12 else 0.0 for i in range(n)]


def grad_hess(beta, data):
    g = [0.0] * K
    H = [[0.0] * K for _ in range(K)]
    for X, w in data:
        W = sum(w)
        if W <= 0:
            continue
        p = softmax(beta, X)
        xbar = [sum(pr * x[i] for pr, x in zip(p, X)) for i in range(K)]
        for wr, x in zip(w, X):
            if wr:
                for i in range(K):
                    g[i] += wr * (x[i] - xbar[i])
        for pr, x in zip(p, X):
            if pr:
                for i in range(K):
                    if x[i]:
                        for j in range(K):
                            if x[j]:
                                H[i][j] -= W * pr * x[i] * x[j]
        for i in range(K):
            for j in range(K):
                H[i][j] += W * xbar[i] * xbar[j]
    return g, H


def m_step(a, d, d_bar, own_data, inh_data, lam, ridge=1.0, iters=8):
    for _ in range(iters):
        go, Ho = grad_hess(a, own_data)
        gi, Hi = grad_hess([x + y for x, y in zip(a, d)], inh_data)
        ga = [go[i] + gi[i] - ridge * a[i] for i in range(K)]
        gd = [gi[i] - lam * (d[i] - d_bar[i]) - 1e-3 * d[i] for i in range(K)]
        A = [[0.0] * (2 * K) for _ in range(2 * K)]
        for i in range(K):
            for j in range(K):
                A[i][j] = -(Ho[i][j] + Hi[i][j]) + (ridge if i == j else 0.0)
                A[i][K + j] = A[K + i][j] = -Hi[i][j]
                A[K + i][K + j] = -Hi[i][j] + ((lam + 1e-3) if i == j else 0.0)
        step = solve(A, ga + gd)
        a = [x + s for x, s in zip(a, step[:K])]
        d = [x + s for x, s in zip(d, step[K:])]
        if max(abs(s) for s in step) < 1e-6:
            break
    return a, d


PARTIES = ("grn", "onp", "oth", "coal", "alp")


def fit(elections, lam, em_iters=EM_ITERS, min_events=6, init=None):
    """elections: {label: events}; lam: {label: shrinkage}. -> {label: {P: (a, d)}}"""
    params, weight = {}, {}
    for lab, evs in elections.items():
        params[lab], weight[lab] = {}, {}
        for P in PARTIES:
            sub = [e for e in evs if e["P"] == P]
            weight[lab][P] = sum(e["own"] + e["inh"] for e in sub)
            if len(sub) >= min_events:
                params[lab][P] = tuple(list(v) for v in init[lab][P]) if init and P in init.get(lab, {}) \
                    else ([0.0] * K, [0.0] * K)
    d_bar = {P: [0.0] * K for P in PARTIES}
    for _ in range(em_iters):
        delta = 0.0
        for lab, evs in elections.items():
            for P, (a, d) in params[lab].items():
                own_data, inh_data = [], []
                for e in evs:
                    if e["P"] != P:
                        continue
                    po = softmax(a, e["X"])
                    pi = softmax([u + v for u, v in zip(a, d)], e["X"])
                    wo, wi = [], []
                    for r, n in enumerate(e["n"]):
                        A_, B_ = e["own"] * po[r], e["inh"] * pi[r]
                        q = A_ + B_
                        wo.append(n * A_ / q if q > 0 else 0.0)
                        wi.append(n * B_ / q if q > 0 else 0.0)
                    own_data.append((e["X"], wo))
                    inh_data.append((e["X"], wi))
                na, nd = m_step(a, d, d_bar[P], own_data, inh_data, lam[lab])
                delta = max(delta, max(abs(x - y) for x, y in zip(na + nd, a + d)))
                params[lab][P] = (na, nd)
        for P in PARTIES:
            ds = [(params[lab][P][1], weight[lab][P]) for lab in params if P in params[lab]]
            W = sum(w for _, w in ds)
            if W > 0:
                d_bar[P] = [sum(v[i] * w for v, w in ds) / W for i in range(K)]
        if delta < 1e-5:
            break
    return params


def ipf(seed, rowt, colt, iters=100):
    T = [r[:] for r in seed]
    for _ in range(iters):
        for i, t in enumerate(rowt):
            s = sum(T[i])
            if s > 0:
                T[i] = [v * t / s for v in T[i]]
        err = 0.0
        for j, t in enumerate(colt):
            s = sum(T[i][j] for i in range(len(T)))
            if s > 0:
                err = max(err, abs(t / s - 1))
                for i in range(len(T)):
                    T[i][j] *= t / s
        if err < 1e-9:
            break
    return T


def replay(s, model=None, evidx=None, label=None):
    """origin-tagged piles to the final two; model=None is the plain replay.
    `label` (candidate -> origin tag) tracks origins finer than the buckets
    the model is keyed by – independents apart from the minor parties."""
    tag = (lambda c: label[c]) if label else (lambda c: s["cands"][c][0])
    piles = {cid: {tag(cid): fp} for cid, (b, fp) in s["cands"].items()}
    for excl, rec, exh in s["steps"]:
        if len(excl) == 1 and model is not None and s["cands"][excl[0]][0] in model:
            x = excl[0]
            P = s["cands"][x][0]
            L = tag(x)
            ev = evidx[x]
            pile = piles.pop(x)
            own = min(s["cands"][x][1], pile.get(L, 0.0))
            inh_pile = dict(pile)
            inh_pile[L] = inh_pile.get(L, 0.0) - own
            inh = sum(v for v in inh_pile.values() if v > 0)
            a, d = model[P]
            po, pi = softmax(a, ev["X"]), softmax([u + v for u, v in zip(a, d)], ev["X"])
            T = ipf([[own * p for p in po], [inh * p for p in pi]], [own, inh], ev["n"])
            for j, rid in enumerate(ev["recs"]):
                if rid not in piles:
                    continue
                if own > 0:
                    piles[rid][L] = piles[rid].get(L, 0.0) + T[0][j]
                if inh > 0:
                    for b, amt in inh_pile.items():
                        if amt > 0:
                            piles[rid][b] = piles[rid].get(b, 0.0) + T[1][j] * amt / inh
            continue
        pile = {}
        for x in excl:
            for b, amt in piles.pop(x).items():
                pile[b] = pile.get(b, 0.0) + amt
        live = [r for r in rec if r in piles]
        den = sum(rec[r] for r in live) + exh
        if den > 0:
            for r in live:
                for b, amt in pile.items():
                    piles[r][b] = piles[r].get(b, 0.0) + amt * rec[r] / den
    return piles


def flows(seats, evs=None, model=None, keys=None):
    """{bucket: [to Labor, to Coalition]} over the classic seats."""
    idx = collections.defaultdict(dict)
    for e in evs or []:
        idx[e["seat"]][e["x"]] = e
    agg = {b: [0.0, 0.0] for b in BUCKETS}
    for k in keys if keys is not None else seats:
        s = seats[k]
        if not classic(s):
            continue
        p = replay(s, model, idx[k]) if model is not None else replay(s)
        a = next(c for c in s["final"] if s["cands"][c][0] == "alp")
        o = next(c for c in s["final"] if c != a)
        for b in BUCKETS:
            agg[b][0] += p[a].get(b, 0.0)
            agg[b][1] += p[o].get(b, 0.0)
    return agg


def contest_flows(seats, evs, model):
    """Labor v One Nation finals: the share of each group's ballots ending with
    Labor rather than One Nation, origins tagged by party id (Liberal and
    National together, Greens, independents, the other minor parties)."""
    idx = collections.defaultdict(dict)
    for e in evs:
        idx[e["seat"]][e["x"]] = e
    tags = {"LIB": "lib", "NAT": "lib", "GRN": "grn", "IND": "ind", "ALP": "alp", "ONP": "onp"}
    agg = collections.defaultdict(lambda: [0.0, 0.0])
    n = 0
    for k, s in seats.items():
        fin = s["final"]
        if len(fin) != 2 or {s["cands"][c][0] for c in fin} != {"alp", "onp"} or not s.get("ids"):
            continue
        n += 1
        label = {c: tags.get(s["ids"][c], "minor") for c in s["cands"]}
        for which, piles in (("model", replay(s, model, idx[k], label)), ("replay", replay(s, label=label))):
            a = next(c for c in fin if s["cands"][c][0] == "alp")
            o = next(c for c in fin if c != a)
            for b in ("lib", "grn", "ind", "minor"):
                agg[(which, b)][0] += piles[a].get(b, 0.0)
                agg[(which, b)][1] += piles[o].get(b, 0.0)
    out = {"seats": n}
    for which in ("model", "replay"):
        g = {b: agg[(which, b)] for b in ("lib", "grn", "ind", "minor")}
        g["oth"] = [g["ind"][0] + g["minor"][0], g["ind"][1] + g["minor"][1]]
        out[which] = {b: round(pct(v), 2) for b, v in g.items() if sum(v)}
    out["ballots"] = {b: round(sum(agg[("model", b)])) for b in ("lib", "grn", "ind", "minor")}
    return out


def pct(v):
    return 100 * v[0] / (v[0] + v[1]) if v[0] + v[1] > 0 else None


def lam_of(seats):
    per = sum(fp for s in seats.values() for (b, fp) in s["cands"].values()) / max(1, len(seats))
    return LAM0 * per / FED_SEAT


# ------------------------------------------------------------------ calibration
_CAL = {}


def _cal_job(args):
    """one federal election cut to N random seats plays a state, pooled with
    the other five in full; its error over those seats, by bucket."""
    y, N, rep = args
    if not _CAL:
        _CAL["fed"] = {yy: fed_election(yy) for yy in FED_YEARS}
        _CAL["evs"] = {yy: events(_CAL["fed"][yy][0]) for yy in FED_YEARS}
    fed, fed_evs = _CAL["fed"], _CAL["evs"]
    seats, truth = fed[y]
    keys = random.Random(911 * N + 17 * rep + y).sample(sorted(seats), N)
    sub = {k: seats[k] for k in keys}
    evs, lam = {("cut", y): events(sub)}, {("cut", y): LAM0}
    for yy in FED_YEARS:
        if yy != y:
            evs[("fed", yy)] = fed_evs[yy]
            lam[("fed", yy)] = lam_of(fed[yy][0])
    p = fit(evs, lam, em_iters=150)
    est = flows(sub, evs[("cut", y)], p[("cut", y)])
    tr = {b: [0.0, 0.0] for b in BUCKETS}
    for k in keys:
        if classic(sub[k]):
            for b, (u, v) in truth.get(k, {}).items():
                tr[b][0] += u
                tr[b][1] += v
    return [{"year": y, "n": N, "bucket": b, "err": round(pct(est[b]) - pct(tr[b]), 3)}
            for b in BUCKETS
            if sum(tr[b]) >= 20000 and not (b == "onp" and y < 2016) and pct(est[b]) is not None]


def calibrate():
    from multiprocessing import Pool
    jobs = [(y, N, rep) for y in FED_YEARS for N in CAL_N for rep in range(CAL_REPS)]
    rows = []
    with Pool(max(1, min(5, (os.cpu_count() or 2) - 1))) as pool:
        for i, r in enumerate(pool.imap_unordered(_cal_job, jobs)):
            rows += r
            print(f"  calibration {i + 1}/{len(jobs)}", file=sys.stderr)
    rows.sort(key=lambda r: (r["n"], r["bucket"], r["year"], r["err"]))
    table = {}
    for N in CAL_N:
        for b in BUCKETS:
            e = sorted(abs(r["err"]) for r in rows if r["n"] == N and r["bucket"] == b)
            v = [r["err"] for r in rows if r["n"] == N and r["bucket"] == b]
            if e:
                table.setdefault(str(N), {})[b] = {"mae": round(sum(e) / len(e), 2),
                                                   "p90": round(e[int(0.9 * (len(e) - 1))], 2),
                                                   "bias": round(sum(v) / len(v), 2), "n": len(e)}
    return table, rows


def onp_min_ballots(fed):
    """The smallest One Nation ballot base the calibration's error figures
    stand on: the 5th percentile of One Nation ballots (reaching Labor or
    the Coalition, classic seats) behind its draws, over the elections One
    Nation contested widely (2016-2025). An estimated One Nation point on
    fewer ballots quotes an error never tested at its size – the federal
    back-test's ~20,000-ballot elections (2010, 2013) missed by 4-5 points,
    outside the drawn bar – so gen-data draws it only above this line."""
    bases = []
    for y in FED_YEARS:
        if y < 2016:
            continue
        seats, truth = fed[y]
        for N in CAL_N:
            for rep in range(CAL_REPS):
                keys = random.Random(911 * N + 17 * rep + y).sample(sorted(seats), N)
                bases.append(sum(sum(truth.get(k, {}).get("onp", [0, 0])) for k in keys if classic(seats[k])))
    bases.sort()
    return round(bases[int(0.05 * (len(bases) - 1))]) if bases else None


def err90(table, b, n):
    """the calibration's 90th-percentile error at n classic seats (linear
    between the grid points, held flat above the largest). Below the
    smallest it is None: an error the calibration never measured would
    understate a small count's (13 seats is not 40), so such an estimate
    carries no err90 and gen-data never draws it."""
    pts = sorted((int(N), t[b]["p90"]) for N, t in table.items() if b in t)
    if not pts or n < pts[0][0]:
        return None
    if n <= pts[0][0]:
        return pts[0][1]
    for (n0, e0), (n1, e1) in zip(pts, pts[1:]):
        if n <= n1:
            return round(e0 + (e1 - e0) * (n - n0) / (n1 - n0), 2)
    return pts[-1][1]


# ------------------------------------------------------------------ main
def main():
    redo_cal = "--calibrate" in sys.argv
    states = {}
    for f in (vic_elections, wa_elections, qld_elections, sa_elections, nt_elections, nsw_elections):
        states.update(f())
    fed = {y: fed_election(y) for y in FED_YEARS}
    fed_evs = {y: events(fed[y][0]) for y in FED_YEARS}
    evs = {k: events(v) for k, v in states.items()}
    lam = {k: lam_of(v) for k, v in states.items()}
    for y in FED_YEARS:
        evs[("fed", y)] = fed_evs[y]
        lam[("fed", y)] = lam_of(fed[y][0])
    print(f"fitting {len(evs)} elections ({len(states)} state, {len(FED_YEARS)} federal) …", file=sys.stderr)
    params = fit(evs, lam)

    federal = {}
    for y in FED_YEARS:
        seats, truth = fed[y]
        cl = [k for k, s in seats.items() if classic(s)]
        tr = {b: [0.0, 0.0] for b in BUCKETS}
        for k in cl:
            for b, (u, v) in truth.get(k, {}).items():
                tr[b][0] += u
                tr[b][1] += v
        model = flows(seats, evs[("fed", y)], params[("fed", y)])
        plain = flows(seats)
        federal[str(y)] = {b: {"counted": round(pct(tr[b]), 2), "model": round(pct(model[b]), 2),
                               "replay": round(pct(plain[b]), 2), "ballots": round(sum(tr[b]))}
                           for b in BUCKETS if sum(tr[b]) > 0}

    old = json.load(open(OUT_JSON)) if os.path.exists(OUT_JSON) else {}
    if redo_cal or "calibration" not in old:
        table, cal_rows = calibrate()
    else:
        table, cal_rows = old["calibration"], old.get("calibration_rows", [])

    rows, qld_check, nsw_check = [], {}, {}
    counted = nsw_counted()
    for (jur, y), seats in sorted(states.items()):
        est = flows(seats, evs[(jur, y)], params[(jur, y)])
        n_cl = sum(1 for s in seats.values() if classic(s))
        if jur == "nsw" and y in counted:
            # NSW is drawn from its counts; the model's reading is the check
            nsw_check[str(y)] = {b: {"counted": round(pct(counted[y][b][:2]), 2), "model": round(pct(est[b]), 2),
                                     "replay": round(pct(flows(seats)[b]), 2)}
                                 for b in BUCKETS if pct(counted[y][b][:2]) is not None and pct(est[b]) is not None}
            for b in BUCKETS:
                v = counted[y][b]
                f = pct(v[:2])
                rows.append({"jurisdiction": jur, "year": y, "party": b, "method": "counted",
                             "est_alp_votes": round(v[0]), "est_coal_votes": round(v[1]),
                             "est_flow_to_alp": round(f / 100, 6) if f is not None else "", "err90": "",
                             "exhausted_share": round(v[2] / sum(v), 4) if sum(v) else "", "n_classic": n_cl})
            continue
        for b in BUCKETS:
            f = pct(est[b])
            e = err90(table, b, n_cl) if f is not None else None
            rows.append({"jurisdiction": jur, "year": y, "party": b,
                         "est_alp_votes": round(est[b][0]), "est_coal_votes": round(est[b][1]),
                         "est_flow_to_alp": round(f / 100, 6) if f is not None else "",
                         "err90": e if e is not None else "",
                         "method": "model", "exhausted_share": "", "n_classic": n_cl})
        if jur == "qld" and y in QLD_GREEN:
            qld_check[str(y)] = {b: {"counted": v, "model": round(pct(est[b]), 2),
                                     "replay": round(pct(flows(seats)[b]), 2)} for b, v in QLD_GREEN[y].items()}

    # SA 2026's 25 Labor v One Nation finals: the contest the site's Labor v
    # One Nation table rests on (quoted in the explainer beside Bonham's)
    contests = {}
    if ("sa", 2026) in states:
        contests["sa-2026-alp-onp"] = contest_flows(states[("sa", 2026)], evs[("sa", 2026)], params[("sa", 2026)])

    with open(OUT_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["jurisdiction", "year", "party", "method", "est_alp_votes", "est_coal_votes",
                                          "est_flow_to_alp", "err90", "exhausted_share", "n_classic"])
        w.writeheader()
        w.writerows(rows)
    with open(OUT_JSON, "w") as f:
        json.dump({"settings": {"lam0": LAM0, "fed_seat": FED_SEAT, "em_iters": EM_ITERS,
                                "pool": [f"{j}-{y}" for j, y in sorted(states)] + [f"fed-{y}" for y in FED_YEARS],
                                "cal_n": list(CAL_N), "cal_reps": CAL_REPS},
                   "federal": federal, "calibration": table, "calibration_rows": cal_rows,
                   "qld_check": qld_check, "nsw_check": nsw_check, "contests": contests,
                   "onp_min_ballots": onp_min_ballots(fed),
                   "qld_source": "https://antonygreen.com.au/qld2024-preference-flows-and-vote-by-type-compared-to-2020/"},
                  f, indent=1)
        f.write("\n")
    print(f"wrote {os.path.relpath(OUT_CSV, ROOT)} ({len(rows)} rows) and {os.path.relpath(OUT_JSON, ROOT)}")
    for y, d in federal.items():
        print(f"  federal {y}: " + "  ".join(f"{b} counted {v['counted']:.1f} model {v['model'] - v['counted']:+.2f} "
                                             f"replay {v['replay'] - v['counted']:+.2f}" for b, v in d.items()))
    for k, d in contests.items():
        print(f"  {k} ({d['seats']} seats) to Labor: " + "  ".join(f"{b} {v:.1f}" for b, v in d["model"].items()))
    for y, d in qld_check.items():
        print(f"  qld {y} vs Green: " + "  ".join(f"{b} model {v['model'] - v['counted']:+.2f} "
                                                   f"replay {v['replay'] - v['counted']:+.2f}" for b, v in d.items()))


if __name__ == "__main__":
    main()
