"""data-sa22.json for /map/ — the South Australian state election of 19 Mar
2022.

build_sa26_data.py's own shape and doctrine on the ECSA's 2022 payload. The
2022 election's caches are the ones the sa26 pipelines committed in
.build/map/src/sa26/ (ecsa-2022-ha.json.gz / ecsa-2022-hac.json.gz, fetched
from the same apim-ecsa endpoints as the 2026 election's); this script reads
them and re-fetches --fetch into the very same names, so the committed
caches stay the one record. --fetch: HAStatic/2022-03-19 + HAChange/2022-03-19/0.

The 2022 payload is an older schema vintage than 2026's, read differently:
  - HAChange/2022 files each district's count ON ITS CANDIDATES
    (candidateId, ordinaryVotes = the polling-place sum, declarationVotes =
    the district's one declaration pile, distributionVotes [{round, tally}]
    — an older field of 2026's finalDistribution). The static file's
    districts key on NAME (districtId is a name string here, not the 2026
    payload's numeric id; profileId is null throughout).
  - Every polling-candidate row carries twoCandidatePref AND twoPartyPref
    fields, both null outside the counted pairs. The 2CP lane reconciles
    EXACTLY: every booth's twoCandidatePref tallies sum to that booth's
    formal votes (measured 0 residual across all 695 places), every
    district's per-candidate booth sums plus its two...PrefDeclarationVotes
    pile equal the final distribution tallies exactly, and the
    distribution's first-round figures equal the lane sums exactly (2026's
    payload had a check-count drift of up to 205; 2022's has none — one
    prove-and-pin DRIFT_MAX keeps it that way).
  - The twoPartyPref lane is a PARTIAL notional machine tally: in the six
    non-classic districts (Finniss, Flinders, Kavel, Mount Gambier,
    Narungga, Stuart — the 2CP pairs ran Liberal v independent) its
    district sums fall short of formal by up to 20%, and where the final
    pair IS Labor v Liberal the "official" row tallies drift up to 2 points
    of share from the distribution finals. No full official TPP exists in
    this payload, so the two-party lanes stay null exactly as sa26's
    (booths' tpp null; classic districts' tpp the distribution finals,
    classic pool in the agg) — the payload's own per-candidate
    twoPartyPrefDeclarationVotes figures are mere duplicates of the booth
    sums, and no declaration pile for the notional count is filed anywhere.
  - early votes ride the district-level declarationVotes pile in 2022; the
    static file's place-type vocabulary is 2022's own ("Polling Booth",
    "Host"/"Visiting 1"/"Visiting 2" for shared booths, "Mobile Poll Team")
    — no early-voting-centre lane exists.

Studied hazard of the 2026-era port: the 2026 payload's distribution rounds
were re-keyed (round objects with candidateResults) — in the 2022 payload
the rounds live per candidate. Cross-checks that bind the scene:

  formal   = Σ pollingPlace formalVotes + candidate.declarationVotes
           (assert ordinaryVotes == the polling-place sum per candidate)
  informal = Σ pollingPlace informalVotes + informalDeclarationVotes
  TCP pair = the two candidates' distributionVotes at the last round; the
             winner the higher tally
  2CP      = Σ booth twoCandidatePref + twoCandidatePrefDeclarationVotes
             == the TCP finals (asserted per candidate)

Booths: every district's 695 polling places ride the federal lane schema;
as in 2026, the ECSA publishes no booth addresses, suburbs or coordinates
(locationAddress/coordinates are null throughout), so prem/sub/pc/lat/lon
are null and no booth dots draw on the map; dec/vdec are null with the
federal files' census lanes never filed at booth level. The census people
lane rides data/sa22-demo.json and the SEIFA lane data/sa22-seifa.json
(.build/map/build_sa22_demo.py / build_sa22_seifa.py, both on the frame's
own 2018–2022-era polygons in .build/map/src/sa26/n-sa22.geojson), spliced
exactly as sa26_generation does. There is no preference-flow store for 2022
(the sa26 lens's two-class pile estimator has no 2022 state loader), so fl
rows are empty and no flBasis key lands in the file.

Boundaries: as sa26's, the district polygons come from the frame's own
boundary source; the geo stage reduces n-sa22.geojson beside the results.

usage: python3 -I .build/map/build_sa22_data.py <out_dir> [--fetch]
then:  python3 -I .build/map/build_sa22_past.py <out_dir>
then:  node .build/map/geo_build.mjs .build/map/src/sa26 <out_dir> map/data --years=sa22
"""
import collections, gzip, json, os, sys, urllib.request

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC26 = os.path.join(REPO, ".build", "map", "src", "sa26")
DEMO_STORE = os.path.join(REPO, "data", "sa22-demo.json")
SEIFA_STORE = os.path.join(REPO, "data", "sa22-seifa.json")
OUT = sys.argv[1]
FETCH = "--fetch" in sys.argv[2:]
BASE = "https://apim-ecsa-production.azure-api.net/results-display"
ELECTION = "2022-03-19"
EXPECTED_SEATS = {"ALP": 27, "LIB": 16, "IND": 4}
# check-count vs lane sums: 2022's payload reconciles exactly (measured 0
# across all 47 districts; 2026's own check-count drift ran up to 205)
DRIFT_MAX = 0
# per-booth 2CP-vs-formal residual: 2022's 695 booths all reconcile exactly
BOOTH_TCP_DRIFT = 0
# the ECSA's 2022 polling-place type strings onto the federal map's booth
# type lane (shared-booth hosts/visitors count as day booths like 2026's)
BOOTH_TYPE = {
    "Polling Booth": 1,
    "Host": 1,
    "Visiting 1": 1,
    "Visiting 2": 1,
    "Mobile Poll Team": 4,
}
# districts whose booth-level 2CP is notional where the final-round pair
# differs (2022: none — every booth's counted pair is the district's final
# pair; any trip here is a fail-stop, never a silent null)
KNOWN_NOTIONAL = set()


def fail(msg):
    raise SystemExit(f"sa22: {msg}")


def fetch(name, path):
    p = os.path.join(SRC26, f"{name}.json.gz")
    if FETCH or not os.path.exists(p):
        req = urllib.request.Request(f"{BASE}/{path}", headers={"User-Agent": "auspol-tracker sa22 cache"})
        with urllib.request.urlopen(req) as r:
            body = r.read()
        obj = json.loads(body)
        json.dumps(obj)  # re-parse sanity
        os.makedirs(SRC26, exist_ok=True)
        with gzip.open(p, "wt", encoding="utf-8") as f:
            f.write(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))
        return obj
    with gzip.open(p, "rt", encoding="utf-8") as f:
        return json.load(f)


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


def load_demo():
    if not os.path.exists(DEMO_STORE):
        fail(f"census store {DEMO_STORE} missing — run .build/map/build_sa22_demo.py")
    with open(DEMO_STORE) as f:
        d = json.load(f)
    if d.get("year") != "sa22" or d.get("demoBasis") != "sa1":
        fail(f"census store is year {d.get('year')!r} basis {d.get('demoBasis')!r}, expected sa22/sa1")
    demo = d.get("demo")
    if not isinstance(demo, dict) or len(demo) != 47:
        fail(f"census store covers {len(demo or {})} districts, expected 47")
    return demo


def load_seifa():
    if not os.path.exists(SEIFA_STORE):
        fail(f"SEIFA store {SEIFA_STORE} missing — run .build/map/build_sa22_seifa.py")
    with open(SEIFA_STORE) as f:
        d = json.load(f)
    if d.get("year") != "sa22":
        fail(f"SEIFA store is year {d.get('year')!r}, expected sa22")
    seifa = d.get("seifa")
    if not isinstance(seifa, dict) or len(seifa) != 47:
        fail(f"SEIFA store covers {len(seifa or {})} districts, expected 47")
    for name, row in seifa.items():
        for ix in ("irsad", "irsd", "ier", "ieo"):
            c = (row or {}).get(ix) or {}
            if not (isinstance(c.get("v"), (int, float)) and isinstance(c.get("dec"), int)
                    and isinstance(c.get("pct"), (int, float))):
                fail(f"SEIFA store: {name}.{ix} lacks a {{v, pct, dec}} cell — rerun build_sa22_seifa.py")
    return seifa


def main():
    os.makedirs(OUT, exist_ok=True)
    ha = fetch("ecsa-2022-ha", f"HAStatic/{ELECTION}")
    hc = fetch("ecsa-2022-hac", f"HAChange/{ELECTION}/0")
    if ha.get("electionDate") != ELECTION or hc.get("electionDate") != ELECTION:
        fail("election dates disagree with the expected 2022-03-19")
    if hc.get("electionStatus") != "final":
        fail(f"electionStatus is {hc.get('electionStatus')!r}, expected final — not ready to file")
    if ha.get("prevElectionDate") != "2018-03-17":
        fail(f"prevElectionDate {ha.get('prevElectionDate')!r} != 2018-03-17")

    ha_d = {d["districtName"]: d for d in ha["districts"]}
    hc_d = {d["districtId"]: d for d in hc["districts"]}
    names = sorted(set(ha_d) | set(hc_d))
    if set(ha_d) != set(hc_d):
        fail(f"district-name sets differ: static-only {sorted(set(ha_d) - set(hc_d))}, change-only {sorted(set(hc_d) - set(ha_d))}")
    if len(names) != 47:
        fail(f"{len(names)} districts, expected 47")
    demo = load_demo()
    seifa = load_seifa()

    D = []
    seats = collections.Counter()
    tot_prim = collections.Counter()
    tot_formal = tot_inf = tot_enrolled = 0
    tpp_tot = [0, 0]
    B = {k: [] for k in ("d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon",
                         "v", "inf", "tpp", "tcp", "fl", "dec", "vdec")}
    types_seen = collections.Counter()
    zero_booths = 0
    for di, name in enumerate(names):
        s = ha_d[name]
        c = hc_d[name]

        # ---- candidates: static is the roster, the change file the count ----
        s_cands = {cd["candidateId"]: cd for cd in s["candidates"]}
        c_cands = {cd["candidateId"]: cd for cd in c["candidates"]}
        if set(s_cands) != set(c_cands):
            fail(f"{name}: candidate id sets differ ({sorted(set(s_cands) ^ set(c_cands))})")

        # static holds the polling-place types; both files name the same places
        s_pp = {}
        for pp in s["pollingPlaces"]:
            pn = pp["pollingPlaceName"]
            if pn in s_pp:
                fail(f"{name}: duplicate polling place {pn!r} in the static file")
            t = pp.get("pollingPlaceType")
            if t not in BOOTH_TYPE:
                fail(f"{name}: unknown polling place type {t!r} ({pn})")
            s_pp[pn] = BOOTH_TYPE[t]
        c_pp = [pp["pollingPlaceName"] for pp in c["pollingPlaces"]]
        if len(c_pp) != len(set(c_pp)):
            fail(f"{name}: duplicate polling place names in the change file")
        if set(c_pp) != set(s_pp):
            fail(f"{name}: static/change polling place sets differ: {sorted(set(c_pp) ^ set(s_pp))}")

        # formal per candidate: polling places + the declaration pile
        formal = collections.Counter()
        for pp in c["pollingPlaces"]:
            for pc in pp["pollingCandidates"]:
                formal[pc["candidateId"]] += pc["formalVotes"]
        for cid in formal:
            if cid not in s_cands:
                fail(f"{name}: vote count for unknown candidate {cid}")
        for cid, cc in c_cands.items():
            own = cc.get("ordinaryVotes") or 0
            if own != formal.get(cid, 0):
                fail(f"{name}: candidate {cid} ordinaryVotes {own} != polling sums {formal.get(cid, 0)}")
            formal[cid] += cc.get("declarationVotes") or 0
        pp_f = sum(pc["formalVotes"] for pp in c["pollingPlaces"] for pc in pp["pollingCandidates"])
        pp_i = sum(pp["informalVotes"] for pp in c["pollingPlaces"])
        decl_all = sum(cc.get("declarationVotes") or 0 for cc in c_cands.values())
        if sum(formal.values()) != pp_f + decl_all:
            fail(f"{name}: formal composition {sum(formal.values())} != {pp_f}+{decl_all}")
        informal = pp_i + c["informalDeclarationVotes"]

        # ---- the final pair and the winner -------------------------------
        # the distribution lives on the change file's candidates as
        # [{round, distributionVote}]; the finalists share the last round
        last_round = 0
        for cd in c["candidates"]:
            for dv in cd.get("distributionVotes") or []:
                last_round = max(last_round, dv["round"])
        if not last_round:
            fail(f"{name}: no preference distribution")
        fin = {}
        for cd in c["candidates"]:
            dvs = cd.get("distributionVotes") or []
            if not dvs:
                fail(f"{name}: candidate {cd['candidateId']} has no distribution rows")
            if dvs[0]["round"] != 1 or [d["round"] for d in dvs] != list(range(1, len(dvs) + 1)):
                fail(f"{name}: candidate {cd['candidateId']} rounds not 1..n")
            drift = abs(dvs[0]["distributionVote"] - formal.get(cd["candidateId"], 0))
            if drift > DRIFT_MAX:
                fail(f"{name}: {s_cands[cd['candidateId']]['candidateName']}: distribution first preferences {dvs[0]['distributionVote']} vs lanes {formal.get(cd['candidateId'], 0)} — beyond drift {DRIFT_MAX}")
            if dvs[-1]["round"] == last_round:
                fin[cd["candidateId"]] = dvs[-1]["distributionVote"]
        if len(fin) != 2:
            fail(f"{name}: final round has {len(fin)} candidates, expected 2")
        if abs(sum(fin.values()) - sum(formal.values())) > DRIFT_MAX:
            fail(f"{name}: distribution final totals {sum(fin.values())} vs formal {sum(formal.values())} — beyond drift {DRIFT_MAX}")

        # ---- rows ----
        (ia, va), (ib, vb) = sorted(fin.items())
        win_id = ia if va > vb else ib
        rows = []
        for cid, cd in s_cands.items():
            nm = cd["candidateName"]
            if "," in nm:
                sur, giv = nm.split(",", 1)
                nm = title_name(giv, sur)
            rows.append({"cid": cid, "n": nm, "ab": cd["partyId"] or "IND", "pn": cd["partyName"] or "Independent",
                         "b": bucket(cd["partyId"]), "v": formal.get(cid, 0), "el": cid == win_id})
        rows.sort(key=lambda r: -r["v"])
        w = next(r for r in rows if r["el"])
        seats[w["ab"]] += 1

        pair_buckets = {bucket(s_cands[l]["partyId"]) for l in (ia, ib)}
        tpp = None
        if pair_buckets == {"alp", "lnp"}:
            alp_l = ia if bucket(s_cands[ia]["partyId"]) == "alp" else ib
            lnp_l = ib if alp_l == ia else ia
            tpp = [fin[alp_l], fin[lnp_l], None]
            tpp_tot[0] += tpp[0]
            tpp_tot[1] += tpp[1]

        cid2row = {r["cid"]: k for k, r in enumerate(rows)}

        # 2CP: per-candidate booth sums plus their declaration pile equal the
        # distribution finals exactly — asserted, never assumed
        two_decl = {cid: (cc.get("twoCandidatePrefDeclarationVotes") or 0)
                    for cid, cc in c_cands.items()}
        tcp_booth_sum = collections.Counter()
        for pp in c["pollingPlaces"]:
            for pc in pp["pollingCandidates"]:
                if pc.get("twoCandidatePref") is not None:
                    tcp_booth_sum[pc["candidateId"]] += pc["twoCandidatePref"]
        for cid in (ia, ib):
            tot = tcp_booth_sum[cid] + two_decl[cid]
            if abs(tot - fin[cid]) > DRIFT_MAX:
                fail(f"{name}: candidate {cid} booth+decl 2CP {tot} != distribution final {fin[cid]}")

        # ---- booths: the district's polling places, on the federal lanes ----
        for bk, pp in enumerate(c["pollingPlaces"]):
            pname = pp["pollingPlaceName"]
            pvotes = [0] * len(rows)
            two_cp = {}
            for pc in pp["pollingCandidates"]:
                cid = pc["candidateId"]
                if cid not in cid2row:
                    fail(f"{name}: booth {pname!r} counts unknown candidate {cid}")
                pvotes[cid2row[cid]] = pc["formalVotes"]
                if pc.get("twoCandidatePref") is not None:
                    two_cp[cid] = pc["twoCandidatePref"]
            if len(two_cp) == 1:
                fail(f"{name}: booth {pname!r} carries a one-sided two-candidate count")
            pformal = sum(pvotes)
            tcp_b = None
            if two_cp:
                if set(two_cp) == {ia, ib}:
                    tcp_b = [two_cp.get(ia, 0), two_cp.get(ib, 0)]
                    if abs(sum(tcp_b) - pformal) > BOOTH_TCP_DRIFT:
                        fail(f"{name}: booth {pname!r} 2CP sum {sum(tcp_b)} vs formal {pformal} — beyond drift {BOOTH_TCP_DRIFT}")
                else:
                    if name not in KNOWN_NOTIONAL:
                        fail(f"{name}: booth {pname!r} counts 2CP for a pair that is not the final-round pair, and the district is not a known notional count")
            if pformal == 0:
                if pp["informalVotes"] != 0:
                    fail(f"{name}: booth {pname!r} records no formal votes but {pp['informalVotes']} informal")
                zero_booths += 1
            ty = s_pp[pname]
            types_seen[ty] += 1
            B["d"].append(di)
            B["id"].append(f"sa22-{di}-{bk}")
            B["n"].append(pname)
            B["ty"].append(ty)
            B["prem"].append(None)
            B["sub"].append(None)
            B["pc"].append(None)
            B["lat"].append(None)
            B["lon"].append(None)
            B["v"].append(pvotes)
            B["inf"].append(pp["informalVotes"])
            B["tpp"].append(None)
            B["tcp"].append(tcp_b)
            B["fl"].append(None)
            B["dec"].append(None)
            B["vdec"].append(None)

        enrolled = s.get("districtEnrolled") or 0
        rec = {
            "id": di, "n": name, "st": "SA",
            "c": [[r["n"], r["ab"], r["pn"], r["b"], r["v"], 0, 1 if r["el"] else 0, 0] for r in rows],
            "inf": informal,
            "tcp": [[cid2row[ia], fin[ia]], [cid2row[ib], fin[ib]]],
            "fl": [],
            "h": [],
            "enrolled": enrolled,
            "demo": demo[name],
            "seifa": seifa[name],
        }
        if tpp:
            rec["tpp"] = tpp
        D.append(rec)
        tot_formal += sum(formal.values())
        tot_inf += informal
        tot_enrolled += enrolled
        for r in rows:
            tot_prim[r["b"]] += r["v"]

    if dict(seats) != EXPECTED_SEATS:
        fail(f"seat counts {dict(seats)} != expected {EXPECTED_SEATS}")

    agg = {"prim": {k: tot_prim[k] for k in BUCKETS}, "formal": tot_formal, "inf": tot_inf,
           "tpp": [tpp_tot[0], tpp_tot[1], None], "seats": dict(seats)}
    out = {"year": "sa22", "date": ELECTION, "prev": None, "jurisdiction": "SA",
           "demoBasis": "sa1",
           "agg": {"AUS": agg, "SA": dict(agg)}, "divs": D, "booths": B}
    p = os.path.join(OUT, "data-sa22.json")
    with open(p, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    tp = 100 * tpp_tot[0] / (tpp_tot[0] + tpp_tot[1])
    print("sa22 districts", len(D), "| seats", dict(seats), "| 2PP-classic ALP", round(tp, 2),
          "| informal", round(100 * tot_inf / (tot_inf + tot_formal), 2), "| enrolled", tot_enrolled,
          "| booths", len(B["id"]), dict(sorted(types_seen.items())), "| zero-vote booths", zero_booths,
          "| sizes", os.path.getsize(p))


main()
