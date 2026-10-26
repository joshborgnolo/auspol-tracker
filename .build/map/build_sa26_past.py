"""The sa26 frame's past election and its upper house, from the ECSA's results API.

Two products, one cache (the build_sa26_data.py pipeline knows neither):

1. The previous SA election (19 March 2022), lower AND upper house, STORED but
   never rendered as its own frame (a user call: "do not display this past
   election data in a map/chamber though, just store it"). The lower house's
   district figures are joined INTO map/data/data-sa26.json so the frame can
   speak of change: `prev` becomes 2022, the aggregate gains pprim/pformal,
   every district gains an `h` history row ([year, TCP%, party, member], the
   federal years' shape), every candidate's change column (c[5], the written
   zero of "no previous-election join") is recomputed as primary points on
   2022 in the seat, and classic-pair districts' `tpp` swings (tpp[2], null
   until now) are filled where 2022's final count was Labor v Liberal too.
   One 2026 district matches no 2022 name: Ngadjuri, the redistributed seat
   the ECSA itself files as Frome's successor (RENAMES below) — it joins on
   that. The raw payloads stay cached (committed) in .build/map/src/sa26/ as
   the stored record; nothing draws a 2022 map from them.

2. The Legislative Council, map/data/senate-sa26.json, in the federal Senate
   files' own shape (year/asOf/senators[{n,st,ab,pn,term,elected}] etc.) with
   lc:true so the app's house toggle labels it "Legislative Council" and its
   copy speaks of 22 members and 12 to pass a bill. SA's council is 22
   members elected statewide, half (11) at each state election to terms
   ending at the election eight years on: the 2026 cohort (terms to 2034,
   from the ECSA's Statement of Results — the results API files the 2026
   count's polling-place detail and party votes but NOT the declared names)
   and the 2022 cohort (terms to 2030, from the API's LCChange summary, which
   does file names). Sarah Game won her 2022 seat for One Nation, left the
   party, and carried the seat into her own (the 2026 LCStatic files it), so
   her council row names that party.

usage: python3 -I .build/map/build_sa26_data.py <map_data_dir>   (first: the frame)
       python3 -I .build/map/build_sa26_past.py <map_data_dir> [--fetch]
then:  node .build/map/geo_build.mjs .build/map/src/sa26 map/data map/data --years=sa26
"""
import gzip, json, os, sys, urllib.request

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(REPO, ".build", "map", "src", "sa26")
OUT = sys.argv[1]
FETCH = "--fetch" in sys.argv[2:]
BASE = "https://apim-ecsa-production.azure-api.net/results-display"
E22, E26 = "2022-03-19", "2026-03-21"
EXPECTED_2022_SEATS = {"ALP": 27, "LIB": 16, "IND": 4}
# the ECSA's redistricting renamed Frome to Ngadjuri for 2026; the seat is its successor
RENAMES = {"Frome": "Ngadjuri"}


def fail(msg):
    raise SystemExit(f"sa26-past: {msg}")


def fetch(name, path):
    p = os.path.join(SRC, f"{name}.json.gz")
    if FETCH or not os.path.exists(p):
        req = urllib.request.Request(f"{BASE}/{path}", headers={"User-Agent": "auspol-tracker sa past cache"})
        with urllib.request.urlopen(req) as r:
            body = r.read()
        obj = json.loads(body)
        json.dumps(obj)
        with gzip.open(p, "wt", encoding="utf-8") as f:
            f.write(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))
        return obj
    with gzip.open(p, "rt", encoding="utf-8") as f:
        return json.load(f)


def title_name(given, surname):
    s = surname or ""
    out = []
    for w in s.split(" "):
        if w.isupper() and len(w) > 1:
            t = w.capitalize()
            for pre in ("Mc", "O'", "D'"):
                if t.startswith(pre) and len(t) > len(pre):
                    t = pre + t[len(pre)].upper() + t[len(pre) + 1:]
            if "-" in t:
                t = "-".join(p[:1].upper() + p[1:] for p in t.split("-"))
            out.append(t)
        else:
            out.append(w)
    return ((given or "").strip() + " " + " ".join(out)).strip()


def flat_name(n):
    n = (n or "").strip()
    if "," in n:
        sur, giv = n.split(",", 1)
        return title_name(giv, sur)
    # LC summary names run "Given SURNAME" in one string
    parts = n.split(" ")
    return title_name(" ".join(parts[:-1]), parts[-1]) if parts else n


COALITION = {"LP", "LNP", "NP", "CLP", "NAT", "LNQ", "LIB"}
BUCKETS = ["alp", "lnp", "grn", "onp", "ind", "oth"]


def bucket(ab):
    ab = (ab or "").upper()
    if ab == "ALP":
        return "alp"
    if ab in COALITION:
        return "lnp"
    if ab == "GRN":
        return "grn"
    if ab in ("ON", "HAN", "ONP"):
        return "onp"
    if ab in ("IND", "", "NAFD"):
        return "ind"
    return "oth"


def r2(v):
    return round(v + 1e-9, 2)


# ---------------------------------------------------------------- the 2022 House of Assembly
def build_2022_ha():
    st = fetch("ecsa-2022-ha", f"HAStatic/{E22}")
    hc = fetch("ecsa-2022-hac", f"HAChange/{E22}/0")
    if st.get("electionDate") != E22 or hc.get("electionDate") != E22:
        fail("2022 payloads' election dates disagree")
    if hc.get("electionStatus") != "final":
        fail(f"2022 electionStatus is {hc.get('electionStatus')!r}, expected final")
    s_d = {d["districtName"]: d for d in st["districts"]}
    c_d = {d["districtId"]: d for d in hc["districts"]}
    if set(s_d) != set(c_d) or len(s_d) != 47:
        fail(f"2022 district sets: {len(s_d)} static vs {len(c_d)} change")
    dists, seats = {}, {}
    formal_all = 0
    prim_all = {b: 0 for b in BUCKETS}
    for name in sorted(s_d):
        s, c = s_d[name], c_d[name]
        roster = {}
        for cd in s["candidates"]:
            roster[cd["candidateId"]] = {"n": flat_name(cd["candidateName"]), "ab": cd["partyId"] or "IND", "pn": cd["partyName"] or "Independent"}
        counts = {cd["candidateId"]: (cd.get("ordinaryVotes") or 0) + (cd.get("declarationVotes") or 0) for cd in c["candidates"]}
        if set(counts) != set(roster):
            fail(f"2022 {name}: roster and count candidate sets differ")
        # the final pair and the winner: the candidates still in the count in
        # the last distribution round; the winner the higher of them
        last_round = 0
        for cd in c["candidates"]:
            for dv in cd.get("distributionVotes") or []:
                last_round = max(last_round, dv["round"])
        if not last_round:
            fail(f"2022 {name}: no distribution rounds")
        fin = {cd["candidateId"]: (cd.get("distributionVotes") or [{}])[-1]["distributionVote"]
               for cd in c["candidates"] if cd.get("distributionVotes") and cd["distributionVotes"][-1]["round"] == last_round}
        if len(fin) != 2:
            fail(f"2022 {name}: final round has {len(fin)} candidates, expected 2")
        (ia, va), (ib, vb) = sorted(fin.items())
        win_id = ia if va >= vb else ib
        w = roster[win_id]
        formal = sum(counts.values())
        pp_i = sum(pp["informalVotes"] for pp in c["pollingPlaces"])
        informal = pp_i + c["informalDeclarationVotes"]
        pair_abs = {roster[ia]["ab"], roster[ib]["ab"]}
        tpp = None
        if pair_abs == {"ALP", "LIB"}:
            v_alp, v_lib = (fin[ia], fin[ib]) if roster[ia]["ab"] == "ALP" else (fin[ib], fin[ia])
            tpp = [v_alp, v_lib]
        prim = {b: 0 for b in BUCKETS}
        for cid, v in counts.items():
            prim[bucket(roster[cid]["ab"])] += v
            prim_all[bucket(roster[cid]["ab"])] += v
        formal_all += formal
        seats[w["ab"]] = seats.get(w["ab"], 0) + 1
        dists[name] = {
            "roster": roster, "counts": counts, "formal": formal, "inf": informal,
            "enrolled": s.get("districtEnrolled") or 0,
            "winner": {"id": win_id, "n": w["n"], "ab": w["ab"],
                       "pct": r2(100 * max(fin[ia], fin[ib]) / (fin[ia] + fin[ib]))},
            "tpp": tpp, "prim": prim,
        }
    if seats != EXPECTED_2022_SEATS:
        fail(f"2022 seats {seats} != expected {EXPECTED_2022_SEATS}")
    return {"dists": dists, "prim": prim_all, "formal": formal_all}


# ---------------------------------------------------------------- the Legislative Council file
# The 2026 LC roster: the ECSA's Statement of Results (declared 4 May 2026),
# https://www.ecsa.sa.gov.au/images/2026SE/2026SE%20StatementResultReport.pdf
# and https://www.ecsa.sa.gov.au/elections/2026se-lc-results — the results API
# itself files party vote totals for 2026 but not the elected names.
ELECTED_2026 = [
    ("Emily Bourke", "ALP"), ("Cory Bernardi", "ONP"), ("Ben Hood", "LIB"), ("Melanie Selwood", "GRN"),
    ("Mira El Dannawi", "ALP"), ("Carlos Quaremba", "ONP"), ("Heidi Girolamo", "LIB"), ("Justin Hanson", "ALP"),
    ("Hilton Gumbys", "ALP"), ("Rebecca Hewett", "ONP"), ("Clare Scriven", "ALP"),
]
EXPECTED_2026_LC_SEATS = {"ALP": 5, "ONP": 3, "LIB": 2, "GRN": 1}
EXPECTED_2022_LC_SEATS = {"ALP": 5, "LIB": 4, "GRN": 1, "FGA": 1}


def build_lc():
    lc26 = fetch("ecsa-2026-lc", f"LCChange/{E26}/0")
    lc26s = fetch("ecsa-2026-lcs", f"LCStatic/{E26}")
    lc22 = fetch("ecsa-2022-lc", f"LCChange/{E22}/0")
    lc22s = fetch("ecsa-2022-lcs", f"LCStatic/{E22}")
    for d, e in ((lc26, E26), (lc22, E22)):
        if d.get("electionDate") != e or d.get("electionStatus") != "final":
            fail(f"LC {e}: date or status off ({d.get('electionDate')!r}, {d.get('electionStatus')!r})")
    if lc26s.get("lcSeatsContested") != 11:
        fail(f"lcSeatsContested {lc26s.get('lcSeatsContested')} != 11")

    # party id -> abbreviations, from the static files
    p26 = {p["id"]: p for p in lc26s["parties"]}
    p22 = {p["id"]: p for p in lc22s["parties"]}

    def ab_of(p):
        pid = (p.get("partyId") or "").upper()
        if pid in ("ALP", "LIB", "GRN", "SAB", "FGA"):
            return pid
        if pid in ("ONP", "ON", "HAN", "PHON") or "ONE NATION" in (p.get("partyName") or "").upper():
            return "ONP"
        if pid == "NOP" or "NO POKIES" in (p.get("partyName") or "").upper():
            return "NOP"
        return pid or (p.get("partyName") or "?")[:4].upper()

    # statewide party votes, 2026 and 2022 (LCChange's parties carry votes)
    votes26, seats26 = {}, {}
    for p in lc26.get("parties") or []:
        ab = ab_of(p26.get(p["id"], {}))
        votes26[ab] = votes26.get(ab, 0) + (p.get("votes") or 0)
        if p.get("candidates"):
            fail("LC 2026 results API unexpectedly files candidates — re-run against the API, not the constant roster")
    votes22 = {}
    elected22 = []
    for grp in lc22.get("parties") or []:
        ab = ab_of(p22.get(grp["id"], {}))
        # Sarah Game, elected for One Nation in 2022, leads her own party
        # into the new term (the 2026 static file's FGA). The votes stay
        # filed under ONP; only her council row relabels
        for cd in grp.get("candidates") or []:
            nm = flat_name(cd["name"])
            row = {"n": nm, "ab": "FGA" if nm == "Sarah Game" and ab == "ONP" else ab, "order": cd["orderElected"]}
            if nm == "Sarah Game" and ab == "ONP":
                row["electedAs"] = "ONP"
            elected22.append(row)
        votes22[ab] = votes22.get(ab, 0) + (grp.get("votes") or 0)
    form26 = lc26.get("totalFormalVotes")
    rem26 = form26 - sum(votes26.values())
    if not 0 <= rem26 <= 2000:
        fail(f"2026 LC: parties' votes leave {rem26} of {form26} unaccounted")
    if rem26:
        # ungrouped candidates are no party group in the payload at all
        print(f"note: {rem26} ungrouped LC votes in 2026 filed as ind")
        votes26["ind"] = votes26.get("ind", 0) + rem26
    form22 = lc22.get("totalFormalVotes")
    rem22 = form22 - sum(votes22.values())
    if not 0 <= rem22 <= 2000:
        fail(f"2022 LC: parties' votes leave {rem22} of {form22} unaccounted")
    if rem22:
        print(f"note: {rem22} ungrouped LC votes in 2022 filed as ind")
        votes22["ind"] = votes22.get("ind", 0) + rem22

    seats = {}
    for _, ab in ELECTED_2026:
        seats[ab] = seats.get(ab, 0) + 1
    if seats != EXPECTED_2026_LC_SEATS:
        fail(f"2026 LC seats {seats} != expected {EXPECTED_2026_LC_SEATS}")
    for _, ab in ELECTED_2026:
        if ab not in votes26:
            fail(f"2026 LC: {ab} has elected members but no filed votes")
    known = {p.get("partyName", "").upper() for p in p26.values()}
    if not any("ONE NATION" in n for n in known):
        fail("2026 LC static no longer files One Nation — recheck the ab map")

    s22 = {}
    for m in elected22:
        s22[m["ab"]] = s22.get(m["ab"], 0) + 1
    if s22 != EXPECTED_2022_LC_SEATS:
        fail(f"2022 LC seats {s22} != expected {EXPECTED_2022_LC_SEATS}")
    if len(elected22) != 11 or len(ELECTED_2026) != 11:
        fail("LC cohorts must each be 11")

    pn = {}
    for coll in (p26, p22):
        for p in coll.values():
            pn.setdefault(ab_of(p), p.get("partyName") or "")
    pn["ONP"] = "Pauline Hanson's One Nation"
    pn["FGA"] = "Sarah Game Fair Go for Australians"
    cohort22 = []
    for m in sorted(elected22, key=lambda x: x["order"]):
        row = {"n": m["n"], "st": "SA", "ab": m["ab"], "pn": pn[m["ab"]], "term": 2030, "elected": 2022}
        if m.get("electedAs"):
            row["electedAs"] = m["electedAs"]
        cohort22.append(row)
    senators = (
        [{"n": n, "st": "SA", "ab": ab, "pn": pn[ab], "term": 2034, "elected": 2026} for n, ab in ELECTED_2026]
        + cohort22
    )
    return {
        "year": "sa26", "lc": True, "asOf": E26, "date": E26, "dd": False, "later": 2034,
        "seatsN": 22, "gov": "alp",
        "source": "ECSA: the 2026 Legislative Council results and Statement of Results, and the 2022 Legislative Council summary",
        "senators": senators,
        "votes": votes26, "pvotes": votes22, "formal": form26, "pformal": form22,
        "inf": lc26.get("totalInformalVotes"),
    }


# ---------------------------------------------------------------- join into the sa26 frame
def main():
    os.makedirs(SRC, exist_ok=True)
    ha = build_2022_ha()
    lc = build_lc()
    sen_path = os.path.join(OUT, "senate-sa26.json")
    with open(sen_path, "w") as f:
        json.dump(lc, f, separators=(",", ":"), ensure_ascii=False)

    data_path = os.path.join(OUT, "data-sa26.json")
    with open(data_path) as f:
        data = json.load(f)
    if data.get("year") != "sa26":
        fail("data-sa26.json is not the sa26 frame")

    agg = data["agg"]
    for st_k in ("AUS", "SA"):
        agg[st_k]["pprim"] = ha["prim"]
        agg[st_k]["pformal"] = ha["formal"]
    data["prev"] = 2022

    n_hist = n_sw = n_tpp = 0
    matched_names = set()
    for div in data["divs"]:
        name = div["n"]
        old = next((k for k, v in RENAMES.items() if v == name), name)
        past = ha["dists"].get(old)
        if not past:
            fail(f"2026 district {name} matches no 2022 district (extend RENAMES if redistricting renamed one)")
        matched_names.add(old)
        w = past["winner"]
        div["h"] = [[2022, w["pct"], w["ab"], w["n"]]]
        n_hist += 1
        formal = sum(r[4] for r in div["c"])
        prev_by_ab = {}
        for cid, v in past["counts"].items():
            ab = past["roster"][cid]["ab"]
            prev_by_ab[ab] = prev_by_ab.get(ab, 0) + v
        for r in div["c"]:
            share = (100 * r[4]) / formal
            # same party id in the seat last time, or the whole share as the
            # change (a candidate whose party didn't stand, the federal files'
            # convention for a new name)
            prev_share = (100 * prev_by_ab[r[1]]) / past["formal"] if r[1] in prev_by_ab else 0.0
            r[5] = r2(share - prev_share)
            n_sw += 1
        if div.get("tpp") and past["tpp"]:
            cur = (100 * div["tpp"][0]) / (div["tpp"][0] + div["tpp"][1])
            old2 = (100 * past["tpp"][0]) / sum(past["tpp"])
            div["tpp"][2] = r2(cur - old2)
            n_tpp += 1
    for k in ha["dists"]:
        if k not in matched_names and k not in RENAMES:
            fail(f"2022 district {k} matched no 2026 district (extend RENAMES if redistricting renamed one)")

    with open(data_path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"sa26 past: {n_hist} history rows, {n_sw} candidate swings, {n_tpp} 2PP swings;"
          f" LC {len(lc['senators'])} members -> senate-sa26.json;"
          f" 2022 stored (HA {ha['formal']} formal, LC {lc['pformal']} formal)")


main()
