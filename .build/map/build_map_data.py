#!/usr/bin/env python3
"""Data for /map/, the Election map (.build/map/; the page is map/index.html).

Joins, per federal election 2004-2025, the repo's committed AEC lanes into
one compact JSON the page reads, and writes the "Now" overlay: the 2026
Farrer by-election (AEC event 31633) and every change of party in the
House since the 2025 election.

  divisions  candidates (all vote types), informal, 2CP + flows (division
             TCF product), 2PP + swing (TPP by division), AEC class,
             SEIFA (all four indexes, interpolated percentile where the
             store has one), vote-type split, 2PP history
  booths     ordinary-vote first preferences per candidate, informal,
             2CP + flows (TCF by polling place), 2PP + swing (TPP by
             polling place), coordinates, premises, SEIFA decile at the
             venue, SEIFA decile of where its voters live (2016+), and the
             language and ages of where its voters live (2021 census, 2016+)

Every booth sum is checked against the division's ordinary-vote oracle
before anything is written (the repo's recompose doctrine), and the
by-election's booth and declaration-vote piles against its own count.

The by-election's AEC downloads are kept beside this script, gzipped
(src/farrer-31633/: candidates, first preferences and general polling places
from the results page, the TCP-flow and distribution-of-preferences by
polling place from the "x" downloads).

usage: python3 -I .build/map/build_map_data.py <out_dir> [<farrer_dir>]
then:  node .build/map/geo_build.mjs <boundary_src_dir> <out_dir> map/data
"""
import csv, gzip, json, os, re, sys, collections

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = REPO + "/.build/aec-flow-src"
BOOTH = SRC + "/booth"
OUT = sys.argv[1]
FARRER = sys.argv[2] if len(sys.argv) > 2 else os.path.join(REPO, ".build", "map", "src", "farrer-31633")
STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
YEARS = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]
EVENT = {2004: 12246, 2007: 13745, 2010: 15508, 2013: 17496, 2016: 20499, 2019: 24310, 2022: 27966, 2025: 31496}
DATE = {2004: "2004-10-09", 2007: "2007-11-24", 2010: "2010-08-21", 2013: "2013-09-07", 2016: "2016-07-02",
        2019: "2019-05-18", 2022: "2022-05-21", 2025: "2025-05-03"}
PREV = {2004: 2001, 2007: 2004, 2010: 2007, 2013: 2010, 2016: 2013, 2019: 2016, 2022: 2019, 2025: 2022}
# the member the new House elected Speaker at its first sitting
SPEAKER = {2004: "Wannon", 2007: "Scullin", 2010: "Scullin", 2013: "Mackellar", 2016: "Casey", 2019: "Casey",
           2022: "Oxley", 2025: "Oxley"}
COALITION = {"LP", "LNP", "NP", "CLP", "NAT", "LNQ"}
BUCKETS = ["alp", "lnp", "grn", "onp", "ind", "oth"]
# 2001 two-party preferred: state rows from the atlas history, the nation from the AEC (Labor 49.05)
TPP2001_AUS = 49.05


def bucket(ab):
    ab = (ab or "").upper()
    if ab == "ALP":
        return "alp"
    if ab in COALITION:
        return "lnp"
    if ab == "GRN":
        return "grn"
    if ab in ("ON", "HAN"):
        return "onp"
    if ab in ("IND", "", "NAFD"):
        return "ind"
    return "oth"


def rows(path):
    op = gzip.open if path.endswith(".gz") else open
    with op(path, "rt", encoding="utf-8-sig", newline="") as f:
        first = f.readline()
        # every AEC download opens with a one-line banner above its header
        if first.startswith(("StateAb", "State,", "DivisionNm", "\"StateAb")):
            f.seek(0)
        return list(csv.DictReader(f))


def fnum(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def title_name(given, surname):
    s = surname or ""
    parts = []
    for w in s.split(" "):
        if w.isupper() and len(w) > 1:
            t = w.capitalize()
            for pre in ("Mc", "O'", "D'"):
                if t.startswith(pre) and len(t) > len(pre):
                    t = pre + t[len(pre)].upper() + t[len(pre) + 1:]
            if "-" in t:
                t = "-".join(p[:1].upper() + p[1:] for p in t.split("-"))
            parts.append(t)
        else:
            parts.append(w)
    return ((given or "").strip() + " " + " ".join(parts)).strip()


def tcpflow_path(year):
    return REPO + "/data/aec-2025-tcp-flow-by-division.csv" if year == 2025 else SRC + f"/tcpflow-{year}.csv.gz"


def load_division_flows(year):
    out = {}
    for r in rows(tcpflow_path(year)):
        d = int(r["DivisionID"])
        e = out.setdefault(d, {"pair": [], "own": {}, "flow": collections.defaultdict(dict)})
        to = int(r["ToCandidateID"])
        n = int(r["TransferCount"])
        fr = int(r["FromCandidateID"])
        if to not in e["pair"]:
            e["pair"].append(to)
        if fr == 0:
            e["own"][to] = n
        else:
            e["flow"][fr][to] = n
    return out


def labor_swing(r, cols):
    """The AEC's Swing column is the swing of whichever party its file lists
    first (the Coalition in 2004, 2007, 2016, 2019 and 2022; Labor in 2010,
    2013 and 2025), and a swing equal to that party's share is the AEC's mark
    for "no comparable figure last time". Returns Labor's swing, or None."""
    lf = cols.index("Australian Labor Party Votes") < cols.index("Liberal/National Coalition Votes")
    sw = fnum(r["Swing"])
    first = fnum(r["Australian Labor Party Percentage" if lf else "Liberal/National Coalition Percentage"])
    if sw is None or (first is not None and abs(sw - first) < 0.011):
        return None
    return sw if lf else round(-sw, 2)


def load_tppdiv(year):
    out = {}
    R = rows(SRC + f"/tppdiv-{year}.csv")
    cols = list(R[0].keys())
    for r in R:
        d = int(r["DivisionID"])
        out[d] = {"alp": int(r["Australian Labor Party Votes"]), "coa": int(r["Liberal/National Coalition Votes"]),
                  "sw": labor_swing(r, cols), "name": r["DivisionNm"], "st": r["StateAb"]}
    return out


def load_fpvvt(year):
    divs = collections.OrderedDict()
    for r in rows(BOOTH + f"/oracle/fpvvt-{year}.csv.gz"):
        d = int(r["DivisionID"])
        e = divs.setdefault(d, {"id": d, "name": r["DivisionNm"], "st": r["StateAb"], "cands": [], "inf": None, "types": collections.Counter()})
        cid = int(r["CandidateID"])
        vt = {k: int(r[c]) for k, c in (("ord", "OrdinaryVotes"), ("abs", "AbsentVotes"), ("prov", "ProvisionalVotes"),
                                         ("pre", "PrePollVotes"), ("post", "PostalVotes"), ("tot", "TotalVotes"))}
        if cid == 999:
            e["inf"] = vt
            continue
        for k, v in vt.items():
            e["types"][k] += v
        e["cands"].append({"cid": cid, "bp": int(r["BallotPosition"]), "n": title_name(r["GivenNm"], r["Surname"]),
                           "ab": r["PartyAb"] or "IND", "pn": r["PartyNm"] or "Independent", "b": bucket(r["PartyAb"]),
                           "v": vt["tot"], "ord": vt["ord"], "sw": fnum(r["Swing"]),
                           "el": r.get("Elected") == "Y", "hel": r.get("HistoricElected") == "Y",
                           "sit": r.get("SittingMemberFl") == "#"})
    for e in divs.values():
        e["cands"].sort(key=lambda c: c["bp"])
    return divs


def load_booth_fpv(year):
    out = collections.OrderedDict()
    for st in STATES:
        for r in rows(BOOTH + f"/fpv/{year}-{st}.csv.gz"):
            k = (int(r["DivisionID"]), int(r["PollingPlaceID"]))
            e = out.setdefault(k, {"name": r["PollingPlace"], "st": r["StateAb"], "votes": {}, "inf": 0})
            cid = int(r["CandidateID"])
            n = int(r["OrdinaryVotes"])
            if cid == 999:
                e["inf"] = n
            else:
                e["votes"][cid] = n
    return out


def load_booth_tpp(year):
    out = {}
    R = rows(BOOTH + f"/tpp-pp/{year}.csv.gz")
    cols = list(R[0].keys())
    for r in R:
        k = (int(r["DivisionID"]), int(r["PollingPlaceID"]))
        out[k] = {"alp": int(r["Australian Labor Party Votes"]), "coa": int(r["Liberal/National Coalition Votes"]),
                  "sw": labor_swing(r, cols), "name": r["PollingPlace"]}
    return out


def load_booth_tcf(year):
    out = {}
    for st in STATES:
        for r in rows(BOOTH + f"/tcf/{year}-{st}.csv.gz"):
            pp = int(r["PPId"])
            if pp == 0:
                continue  # declaration-vote piles (ABSENT/POSTAL/...)
            k = (int(r["DivisionId"]), pp)
            e = out.setdefault(k, {"own": {}, "flow": collections.defaultdict(dict)})
            fr = int(r["FromCandidateId"])
            to = int(r["ToCandidateId"])
            n = int(r["TransferCount"])
            if fr == 0:
                e["own"][to] = n
            else:
                e["flow"][fr][to] = n
    return out


def load_gpp(path):
    out = {}
    for r in rows(path):
        k = (int(r["DivisionID"]), int(r["PollingPlaceID"]))
        out[k] = {"type": int(r["PollingPlaceTypeID"]), "prem": r["PremisesNm"].strip(),
                  "sub": r["PremisesSuburb"].strip().title(), "pc": r["PremisesPostCode"].strip(),
                  "lat": fnum(r.get("Latitude")), "lon": fnum(r.get("Longitude"))}
    return out


def gpp_path(year):
    d = REPO + f"/atlas/data/aec-{year}"
    f = next(x for x in os.listdir(d) if x.startswith("GeneralPollingPlacesDownload"))
    return d + "/" + f


def norm_pp(s):
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s or "")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def dec_of_pct(p):
    if p is None:
        return None
    return min(10, max(1, int(-(-p * 10 // 1))))


# census people measures, 2021 census, weighted by where a place's voters live (2016+):
# [language other than English at home, aged 65 and over, aged 20 to 34], each a share of residents
def demo_cells(dm):
    if not dm or dm.get("langOther") is None or not dm.get("age"):
        return None
    a = dm["age"]
    return [dm["langOther"], round(a["65_74"] + a["75_84"] + a["85ov"], 4), round(a["20_24"] + a["25_34"], 4)]


def seifa_cells(sf):
    S = {}
    for ix in ("irsad", "irsd", "ier", "ieo"):
        c = sf.get(ix)
        if not c:
            continue
        p = c.get("pcti", c.get("pct"))
        S[ix] = {"v": c.get("value"), "pct": p, "dec": dec_of_pct(p)}
    return S


# ---------------------------------------------------------------- history
def build_history():
    """per division NAME: [year, Labor 2PP, winner party, winner name]. The
    winner is the 2CP leader in the division TCP-flow product (2004's
    candidate file carries no Elected column, so the count decides)."""
    hist = collections.defaultdict(list)
    for hy in YEARS:
        tp = load_tppdiv(hy)
        tot = collections.defaultdict(collections.Counter)
        meta = {}
        for r in rows(tcpflow_path(hy)):
            d = int(r["DivisionID"])
            to = int(r["ToCandidateID"])
            tot[d][to] += int(r["TransferCount"])
            meta[(d, to)] = (r["ToCandidatePartyAb"] or "IND", title_name(r["ToCandidateGivenNm"], r["ToCandidateSurname"]), r["DivisionNm"])
        for d, c in tot.items():
            w = max(c, key=lambda k: c[k])
            ab, nm, dn = meta[(d, w)]
            t = tp.get(d)
            a2 = round(100 * t["alp"] / (t["alp"] + t["coa"]), 2) if t and t["alp"] + t["coa"] else None
            hist[dn].append([hy, a2, ab, nm])
    for v in hist.values():
        v.sort()
    return hist


# ---------------------------------------------------------------- 2001 baselines for 2004's swings
def load_2001():
    prim = collections.defaultdict(collections.Counter)
    with open(SRC + "/hcands-2001.txt", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f, delimiter=";"):
            v = int(r["Vote"])
            b = bucket(r["Party"])
            prim[r["State"]][b] += v
            prim["AUS"][b] += v
    tpp = {}
    with open(REPO + "/atlas/data/all_elections_2PP_by_state.csv", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if r["Year"] == "2001":
                tpp[r["State"]] = float(r["Labor_2PP_percent"])
    tpp["AUS"] = TPP2001_AUS
    names = set()
    with gzip.open(BOOTH + "/fpv/2001.csv.gz", "rt", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f, delimiter=";"):
            names.add((r["Division"], norm_pp(r["Polling Place"])))
    return prim, tpp, names


def build_year(year, hist, base2001):
    prev = PREV[year]
    divs = load_fpvvt(year)
    divs_prev = load_fpvvt(prev) if prev >= 2004 else None
    tppd = load_tppdiv(year)
    tppd_prev = load_tppdiv(prev) if prev >= 2004 else None
    dflow = load_division_flows(year)
    bfpv = load_booth_fpv(year)
    btpp = load_booth_tpp(year)
    btcf = load_booth_tcf(year)
    gpp = load_gpp(gpp_path(year))
    cls = json.load(open(REPO + "/data/division-classifications.json"))["elections"][str(year)]
    seifa = json.load(open(REPO + "/data/division-seifa-indexes.json"))["elections"][str(year)]
    bseifa = {(b["divId"], b["boothId"]): b for b in json.load(open(REPO + f"/data/booth-seifa-{year}.json"))["booths"]}
    vpath = REPO + f"/data/booth-seifa-voter-{year}.json"
    vstore = json.load(open(vpath)) if os.path.exists(vpath) else None
    bvoter = {(b["divId"], b["boothId"]): b for b in vstore["booths"]} if vstore else {}
    if prev >= 2004:
        prev_pp = {(int(r["DivisionID"]), int(r["PollingPlaceID"])) for r in rows(BOOTH + f"/tpp-pp/{prev}.csv.gz")}
        prev_ids = {pp for (_, pp) in prev_pp}
        had_prev = lambda d, pp, name: pp in prev_ids
    else:
        names01 = base2001[2]
        had_prev = lambda d, pp, name: (divs[d]["name"], norm_pp(name)) in names01

    # ---- recompose: booth ordinary FPV must sum to the division oracle ----
    sums = collections.defaultdict(collections.Counter)
    for (d, pp), b in bfpv.items():
        for cid, n in b["votes"].items():
            sums[d][cid] += n
        sums[d][999] += b["inf"]
    bad = sum(1 for d, e in divs.items() for c in e["cands"] if sums[d][c["cid"]] != c["ord"])
    bad += sum(1 for d, e in divs.items() if sums[d][999] != e["inf"]["ord"])
    assert bad == 0, f"{year}: {bad} booth/division ordinary-vote mismatches"

    # ---- the winner: the 2CP leader (2004 has no Elected column) ----
    for d, e in divs.items():
        fl = dflow[d]
        tcp = {cid: fl["own"].get(cid, 0) + sum(t.get(cid, 0) for t in fl["flow"].values()) for cid in fl["pair"]}
        w = max(tcp, key=lambda k: tcp[k])
        for c in e["cands"]:
            if year == 2004:
                c["el"] = c["cid"] == w
            elif c["el"] != (c["cid"] == w):
                raise SystemExit(f"{year} {e['name']}: Elected flag disagrees with the count")

    # ---- SEIFA decile cut points (venue store) to place voter-footprint scores ----
    cuts = {}
    for ix in ("irsad", "irsd", "ier", "ieo"):
        lo = collections.defaultdict(list)
        for b in bseifa.values():
            s = b.get("seifa")
            if s and s.get(ix) is not None and (s.get("dec") or {}).get(ix):
                lo[s["dec"][ix]].append(s[ix])
        cuts[ix] = [round((max(lo[k]) + min(lo[k + 1])) / 2, 1) for k in range(1, 10)] if all(lo[k] for k in range(1, 11)) else None

    def dec_of(ix, score):
        if score is None or not cuts[ix]:
            return None
        return 1 + sum(1 for c in cuts[ix] if score >= c)

    # early-voting-centre share of ordinary votes (booth type 5 = PPVC)
    ppvc = collections.Counter()
    for (bd, pp), b in bfpv.items():
        if gpp.get((bd, pp), {}).get("type") == 5:
            ppvc[bd] += sum(b["votes"].values()) + b["inf"]

    D = []
    div_index = {}
    for d, e in divs.items():
        name = e["name"]
        fl = dflow[d]
        pair = fl["pair"]
        cidx = {c["cid"]: i for i, c in enumerate(e["cands"])}
        tcp = {cid: fl["own"].get(cid, 0) + sum(t.get(cid, 0) for t in fl["flow"].values()) for cid in pair}
        flows = [[cidx[fr], t.get(pair[0], 0), t.get(pair[1], 0)] for fr, t in fl["flow"].items() if fr in cidx]
        tp = tppd[d]
        cl = cls.get(name) or {}
        vt = e["types"]
        rec = {
            "id": d, "n": name, "st": e["st"],
            "cls": cl.get("classification"),
            "c": [[c["n"], c["ab"], c["pn"], c["b"], c["v"], c["sw"], 1 if c["el"] else 0, 1 if c["sit"] else 0] for c in e["cands"]],
            "inf": e["inf"]["tot"],
            "vt": {"ord": vt["ord"], "pre": vt["pre"], "post": vt["post"], "abs": vt["abs"], "prov": vt["prov"], "ppvc": ppvc[d]},
            "tcp": [[cidx[pair[0]], tcp[pair[0]]], [cidx[pair[1]], tcp[pair[1]]]],
            "fl": flows,
            "tpp": [tp["alp"], tp["coa"], tp["sw"]],
            "seifa": seifa_cells(seifa.get(name) or {}),
            "h": hist.get(name, []),
        }
        if vstore:
            dd = next((x for x in vstore.get("divisions", []) if x.get("div") == name), None)
            dc = demo_cells(dd)
            if dc:
                # p: the store's vote-weighted pseudo-population, to pool states and the nation
                rec["demo"] = {"lang": dc[0], "a65": dc[1], "a2034": dc[2], "p": dd["persons"]}
        div_index[d] = len(D)
        D.append(rec)

    # ---- booths ----
    B = collections.defaultdict(list)
    n_coords = 0
    for (d, pp), b in bfpv.items():
        e = divs[d]
        cidx = {c["cid"]: i for i, c in enumerate(e["cands"])}
        g = gpp.get((d, pp)) or {}
        sv = bseifa.get((d, pp)) or {}
        lat = sv.get("lat", g.get("lat"))
        lon = sv.get("lon", g.get("lon"))
        if lat in (0, None) or lon in (0, None):
            lat = lon = None
        else:
            n_coords += 1
        votes = [b["votes"].get(c["cid"], 0) for c in e["cands"]]
        t = btpp.get((d, pp))
        f = btcf.get((d, pp))
        tcp = flows = None
        if f:
            pair = dflow[d]["pair"]
            tc = {cid: f["own"].get(cid, 0) + sum(x.get(cid, 0) for x in f["flow"].values()) for cid in pair}
            tcp = [tc[pair[0]], tc[pair[1]]]
            flows = [[cidx[fr], x.get(pair[0], 0), x.get(pair[1], 0)] for fr, x in f["flow"].items() if fr in cidx]
        seif = sv.get("seifa") or {}
        dec = (seif.get("dec") or {}) if seif else {}
        vs = (bvoter.get((d, pp)) or {}).get("seifa") or {}
        B["d"].append(div_index[d])
        B["id"].append(pp)
        B["n"].append(b["name"])
        B["ty"].append(g.get("type", 0))
        B["prem"].append(g.get("prem", ""))
        B["sub"].append(g.get("sub", ""))
        B["pc"].append(g.get("pc", ""))
        B["lat"].append(round(lat, 5) if lat is not None else None)
        B["lon"].append(round(lon, 5) if lon is not None else None)
        B["v"].append(votes)
        B["inf"].append(b["inf"])
        B["tpp"].append([t["alp"], t["coa"], t["sw"]] if t else None)
        B["tcp"].append(tcp)
        B["fl"].append(flows)
        B["dec"].append([dec.get("irsad"), dec.get("irsd"), dec.get("ier"), dec.get("ieo")] if dec else None)
        B["vdec"].append([dec_of(ix, vs.get(ix)) for ix in ("irsad", "irsd", "ier", "ieo")] if vs else None)
        B["demo"].append(demo_cells((bvoter.get((d, pp)) or {}).get("demo")))

    if not any(B["demo"]):
        del B["demo"]  # no voter footprint before 2016

    # ---- state + national aggregates (all vote types) ----
    def agg(st):
        ds = [e for e in divs.values() if st == "AUS" or e["st"] == st]
        prim = collections.Counter()
        formal = inf = 0
        for e in ds:
            for c in e["cands"]:
                prim[c["b"]] += c["v"]
                formal += c["v"]
            inf += e["inf"]["tot"]
        tp = [x for x in tppd.values() if st == "AUS" or x["st"] == st]
        alp = sum(x["alp"] for x in tp)
        coa = sum(x["coa"] for x in tp)
        if divs_prev is not None:
            pds = [e for e in divs_prev.values() if st == "AUS" or e["st"] == st]
            pprim = collections.Counter()
            pformal = 0
            for e in pds:
                for c in e["cands"]:
                    pprim[c["b"]] += c["v"]
                    pformal += c["v"]
            ptp = [x for x in tppd_prev.values() if st == "AUS" or x["st"] == st]
            palp = sum(x["alp"] for x in ptp)
            pcoa = sum(x["coa"] for x in ptp)
            p2 = 100 * palp / (palp + pcoa)
        else:
            pprim = base2001[0][st]
            pformal = sum(pprim.values())
            p2 = base2001[1][st]
        seats = collections.Counter()
        for e in ds:
            w = next(c for c in e["cands"] if c["el"])
            seats[w["ab"]] += 1
        return {"prim": {k: prim[k] for k in BUCKETS}, "pprim": {k: pprim[k] for k in BUCKETS},
                "formal": formal, "pformal": pformal, "inf": inf,
                "tpp": [alp, coa, round(100 * alp / (alp + coa) - p2, 2)], "seats": dict(seats)}

    A = {st: agg(st) for st in ["AUS"] + STATES}
    out = {"year": year, "event": EVENT[year], "date": DATE[year], "prev": prev, "speaker": SPEAKER[year],
           "agg": A, "divs": D, "booths": B, "seifaCuts": cuts}
    names = {x["n"] for x in D}
    assert SPEAKER[year] in names, f"{year}: speaker seat {SPEAKER[year]} not in the House"
    p = os.path.join(OUT, f"data-{year}.json")
    with open(p, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(year, "divisions", len(D), "booths", len(B["id"]), "with coords", n_coords, "->", os.path.getsize(p), "bytes",
          "| 2PP", round(100 * A["AUS"]["tpp"][0] / (A["AUS"]["tpp"][0] + A["AUS"]["tpp"][1]), 2), "swing", A["AUS"]["tpp"][2],
          "| informal", round(100 * A["AUS"]["inf"] / (A["AUS"]["inf"] + A["AUS"]["formal"]), 2))
    return out


# ---------------------------------------------------------------- the Farrer by-election (event 31633)
def build_farrer(y2025):
    def frows(name):
        return rows(os.path.join(FARRER, name + ".gz"))
    cand_rows = frows("HouseCandidatesDownload-31633.csv")
    fp = frows("HouseStateFirstPrefsByPollingPlaceDownload-31633-NSW.csv")
    tcf = frows("HouseTcpFlowByPPDownload-31633-NSW.csv")
    dop = frows("HouseDopByPPDownload-31633-NSW.csv")
    gpp = load_gpp(os.path.join(FARRER, "GeneralPollingPlacesDownload-31633.csv.gz"))

    # candidates in ballot order (the FP file carries the ballot position)
    bp = {}
    for r in fp:
        if int(r["CandidateID"]) != 999:
            bp[int(r["CandidateID"])] = int(r["BallotPosition"])
    cands = []
    for r in cand_rows:
        cid = int(r["CandidateID"])
        cands.append({"cid": cid, "bp": bp[cid], "n": title_name(r["GivenNm"], r["Surname"]), "ab": r["PartyAb"] or "IND",
                      "pn": r["PartyNm"] or "Independent", "b": bucket(r["PartyAb"]), "el": r["Elected"] == "Y"})
    cands.sort(key=lambda c: c["bp"])
    cidx = {c["cid"]: i for i, c in enumerate(cands)}

    # every pile's first preferences (ordinary booths + declaration piles) from the DOP's count 0
    total = collections.Counter()
    by_pp_count0 = collections.defaultdict(collections.Counter)
    for r in dop:
        if r["CountNum"] == "0" and r["CalculationType"] == "Preference Count":
            total[int(r["CandidateId"])] += int(r["CalculationValue"])
            by_pp_count0[(int(r["PPId"]), r["PPNm"])][int(r["CandidateId"])] += int(r["CalculationValue"])
    # booths: ordinary first preferences and informal
    booths = collections.OrderedDict()
    for r in fp:
        pp = int(r["PollingPlaceID"])
        e = booths.setdefault(pp, {"name": r["PollingPlace"], "votes": {}, "inf": 0, "sw": {}})
        cid = int(r["CandidateID"])
        n = int(r["OrdinaryVotes"])
        if cid == 999:
            e["inf"] = n
        else:
            e["votes"][cid] = n
    # recompose: the booths' ordinary piles must equal the DOP's per-booth count 0
    for pp, e in booths.items():
        dk = next((k for k in by_pp_count0 if k[0] == pp), None)
        assert dk is not None and all(by_pp_count0[dk][cid] == n for cid, n in e["votes"].items()), f"Farrer booth {pp} disagrees with the DOP"
    # flows: TCF by polling place (PPId 0 = declaration piles, which still count toward the division)
    pair = []
    own = collections.Counter()
    flow = collections.defaultdict(collections.Counter)
    bt = collections.defaultdict(lambda: {"own": collections.Counter(), "flow": collections.defaultdict(collections.Counter)})
    for r in tcf:
        to = int(r["ToCandidateId"])
        fr = int(r["FromCandidateId"])
        n = int(r["TransferCount"])
        pp = int(r["PPId"])
        if to not in pair:
            pair.append(to)
        if fr == 0:
            own[to] += n
            if pp:
                bt[pp]["own"][to] += n
        else:
            flow[fr][to] += n
            if pp:
                bt[pp]["flow"][fr][to] += n
    assert len(pair) == 2
    tcp = {cid: own[cid] + sum(t[cid] for t in flow.values()) for cid in pair}
    # informal: the declaration piles' informal ballots are not in the booth file, so the
    # division's total is the AEC's final 7,599 (turnout 108,885 less 101,286 formal)
    formal = sum(total.values())
    inf_booths = sum(e["inf"] for e in booths.values())

    # 2025 at the same booths (by polling place ID) for primary swings by party
    prev_div = next(x for x in y2025["divs"] if x["n"] == "Farrer")
    pi = y2025["divs"].index(prev_div)
    B25 = y2025["booths"]
    prev_b = {}
    for j in range(len(B25["id"])):
        if B25["d"][j] == pi:
            prev_b[B25["id"][j]] = j

    D = {
        "id": 118, "n": "Farrer", "st": "NSW", "cls": prev_div["cls"],
        "c": [[c["n"], c["ab"], c["pn"], c["b"], total[c["cid"]], None, 1 if c["el"] else 0, 0] for c in cands],
        "inf": None,
        "tcp": [[cidx[pair[0]], tcp[pair[0]]], [cidx[pair[1]], tcp[pair[1]]]],
        "fl": [[cidx[fr], t[pair[0]], t[pair[1]]] for fr, t in flow.items()],
        "tpp": None,
        "seifa": prev_div["seifa"],
        "demo": prev_div.get("demo"),
        "h": prev_div["h"] + [[2026, None, next(c["ab"] for c in cands if c["el"]), next(c["n"] for c in cands if c["el"]), "by"]],
    }
    # booth columns, the 2025 store's SEIFA deciles carried by polling place ID where the place returns
    Bb = collections.defaultdict(list)
    for pp, e in booths.items():
        g = gpp.get((118, pp)) or {}
        lat, lon = g.get("lat"), g.get("lon")
        if lat in (0, None) or lon in (0, None):
            lat = lon = None
        f = bt.get(pp)
        btcp = bfl = None
        if f:
            tc = {cid: f["own"][cid] + sum(x[cid] for x in f["flow"].values()) for cid in pair}
            btcp = [tc[pair[0]], tc[pair[1]]]
            bfl = [[cidx[fr], x[pair[0]], x[pair[1]]] for fr, x in f["flow"].items()]
        j25 = prev_b.get(pp)
        Bb["d"].append(0)
        Bb["id"].append(pp)
        Bb["n"].append(e["name"])
        Bb["ty"].append(g.get("type", 0))
        Bb["prem"].append(g.get("prem", ""))
        Bb["sub"].append(g.get("sub", ""))
        Bb["pc"].append(g.get("pc", ""))
        Bb["lat"].append(round(lat, 5) if lat is not None else None)
        Bb["lon"].append(round(lon, 5) if lon is not None else None)
        Bb["v"].append([e["votes"].get(c["cid"], 0) for c in cands])
        Bb["inf"].append(e["inf"])
        Bb["tpp"].append(None)
        Bb["tcp"].append(btcp)
        Bb["fl"].append(bfl)
        Bb["dec"].append(B25["dec"][j25] if j25 is not None else None)
        Bb["vdec"].append(B25["vdec"][j25] if j25 is not None else None)
        Bb["demo"].append(B25["demo"][j25] if j25 is not None else None)
        Bb["prev"].append(j25)  # index into the 2025 booths, for swings at the same place
    print("Farrer by-election: formal", formal, "booth informal", inf_booths, "2CP",
          {cands[cidx[c]]["n"]: tcp[c] for c in pair}, "booths", len(booths))
    return {"div": D, "booths": Bb, "formal": formal, "informal": 7599, "enrolment": 124447, "turnout": 108885}


def main():
    os.makedirs(OUT, exist_ok=True)
    hist = build_history()
    base2001 = load_2001()
    out = {}
    for y in YEARS:
        out[y] = build_year(y, hist, base2001)
    far = build_farrer(out[2025])
    now = {
        "asOf": "2026-10-25",
        # every change in the House since the 2025 election (dates: AEC, APH, the parties)
        "changes": [
            {"div": "New England", "date": "2025-11-27", "kind": "left", "who": "Barnaby Joyce", "from": "NP", "to": "IND",
             "text": "Barnaby Joyce left the Nationals to sit as an independent"},
            {"div": "New England", "date": "2025-12-08", "kind": "joined", "who": "Barnaby Joyce", "from": "IND", "to": "ON",
             "text": "Barnaby Joyce joined One Nation"},
            {"div": "Farrer", "date": "2026-02-27", "kind": "resigned", "who": "Sussan Ley", "from": "LP", "to": None,
             "text": "Sussan Ley resigned from Parliament"},
            {"div": "Farrer", "date": "2026-05-09", "kind": "by-election", "who": "David Farley", "from": None, "to": "ON",
             "text": "David Farley won the by-election for One Nation"},
            {"div": "Wentworth", "date": "2026-06-25", "kind": "founded", "who": "Allegra Spender", "from": "IND", "to": "CSA",
             "text": "Allegra Spender co-founded Community Strong Australia"},
            {"div": "Warringah", "date": "2026-06-25", "kind": "founded", "who": "Zali Steggall", "from": "IND", "to": "CSA",
             "text": "Zali Steggall co-founded Community Strong Australia"},
        ],
        # who holds each changed seat today
        "holders": {"New England": {"n": "Barnaby Joyce", "ab": "ON"}, "Farrer": {"n": "David Farley", "ab": "ON"},
                    "Wentworth": {"n": "Allegra Spender", "ab": "CSA"}, "Warringah": {"n": "Zali Steggall", "ab": "CSA"}},
        "byelections": {"Farrer": {"date": "2026-05-09", "event": 31633, **far}},
    }
    p = os.path.join(OUT, "data-now.json")
    with open(p, "w") as f:
        json.dump(now, f, separators=(",", ":"), ensure_ascii=False)
    print("now ->", os.path.getsize(p), "bytes")


main()
