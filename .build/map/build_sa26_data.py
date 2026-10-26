"""data-sa26.json for /map/ — the South Australian state election of 21 Mar 2026.

The district-level sibling of build_map_data.py's federal product: the page's
res schema (.build/map/app/app-1-base.js deriveDiv), filled from the Electoral
Commission SA's results API rather than the AEC's downloads:

  https://apim-ecsa-production.azure-api.net/results-display/HAStatic/2026-03-21
  https://apim-ecsa-production.azure-api.net/results-display/HAChange/2026-03-21/0

Both responses are cached verbatim (gzipped) in .build/map/src/sa26/ and the
build reads the cache by default; --fetch re-downloads and re-caches them.
HAStatic supplies candidates (id, "SURNAME, Given", party id/name) and enrolment;
HAChange (status "final", dataVersion 912) supplies every polling place's
formal/informal counts, the declaration piles, and the preference distribution.

Totals doctrine (proved against the live API on all 47 districts, 2026-10-26):
  formal  = sum of pollingPlace candidateVotes' formalVotes
          + sum of declarations candidateVotes
          + sum of absentOrdinary candidateVotes
            (absentOrdinary is a SEPARATE ordinary lane — absentees' votes
            counted with the district but reported apart; the API's own
            candidates[].ordinaryVotes + declarationTotals equal only the
            pollingPlace + declaration part)
  informal = sum of pollingPlace informalVotes + informalDeclarationVotes
            + sum of absentOrdinary informalVotes
            (informalDeclarationVotes equals sum of declarations informalVotes)
  TCP     = the final preference-distribution round's two non-excluded
            progressiveTotal; the elected candidate carries isElected
The preference distribution is ECSA's CHECK count (the official recount),
and its opening-round figures disagree with the lane sums by a re-allocation
of up to ~205 votes in 22 of 47 districts (King 2026) — drift the bound
DRIFT_MAX tolerates, corruption exceeds. The distribution names ECSA's
global candidate ids while every other lane uses the per-district 1..n
roster — join on candidate-name tokens. Every cross-check is asserted here:
a drift in ECSA's payload is answered with a fail-stop, never a
close-enough row.

There is no swing source in the API (no previous-election figures), so
changes are the "unknown" kind, per-candidate chg is 0, and tpp swings are
null; prev is null. No booth (polling place) lane: the site shows districts
only. The census people lane rides data/sa26-demo.json (GCP 2021 SA1
tables pooled to the 47 districts by .build/map/build_sa26_demo.py): each
division row gains demo, and the year file records demoBasis "sa1". The
SEIFA lane rides data/sa26-seifa.json (ABS SEIFA 2021 SA1 index scores
population-weighted onto the same districts by .build/map/build_sa26_seifa.py
on the people pipeline's own SA1→district join): each division row gains
seifa {ix: {v, pct, dec}} cells shaped like the federal rec's, deciles
ranked among the frame's own 47.
Boundaries are SA's own State Electorates 2026 geojson (data.sa.gov.au),
committed-free like the federal n-YYYY.geojson era files; the reducer keeps
one `name` property per feature (title case, the ECSA names it joins to).

usage: python3 -I .build/map/build_sa26_data.py <out_dir> [--fetch]
then:  node .build/map/geo_build.mjs <boundary_src_dir> <out_dir> map/data --years=sa26
"""
import collections, gzip, json, os, sys, urllib.request

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(REPO, ".build", "map", "src", "sa26")
DEMO_STORE = os.path.join(REPO, "data", "sa26-demo.json")
SEIFA_STORE = os.path.join(REPO, "data", "sa26-seifa.json")
OUT = sys.argv[1]
FETCH = "--fetch" in sys.argv[2:]
BASE = "https://apim-ecsa-production.azure-api.net/results-display"
ELECTION = "2026-03-21"
EXPECTED_SEATS = {"ALP": 34, "LIB": 5, "IND": 4, "ONP": 4}
# check-count vs first-count drift: elected densities observe ≤205 votes in 2026
DRIFT_MAX = 300


def fail(msg):
    raise SystemExit(f"sa26: {msg}")


def fetch(name, path):
    p = os.path.join(SRC, f"{name}.json.gz")
    if FETCH or not os.path.exists(p):
        req = urllib.request.Request(f"{BASE}/{path}", headers={"User-Agent": "auspol-tracker ec sa cache"})
        with urllib.request.urlopen(req) as r:
            body = r.read()
        obj = json.loads(body)
        json.dumps(obj)  # re-parse sanity
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
        fail(f"census store {DEMO_STORE} missing — run .build/map/build_sa26_demo.py")
    with open(DEMO_STORE) as f:
        d = json.load(f)
    if d.get("year") != "sa26" or d.get("demoBasis") != "sa1":
        fail(f"census store is year {d.get('year')!r} basis {d.get('demoBasis')!r}, expected sa26/sa1")
    demo = d.get("demo")
    if not isinstance(demo, dict) or len(demo) != 47:
        fail(f"census store covers {len(demo or {})} districts, expected 47")
    return demo


def load_seifa():
    if not os.path.exists(SEIFA_STORE):
        fail(f"SEIFA store {SEIFA_STORE} missing — run .build/map/build_sa26_seifa.py")
    with open(SEIFA_STORE) as f:
        d = json.load(f)
    if d.get("year") != "sa26":
        fail(f"SEIFA store is year {d.get('year')!r}, expected sa26")
    seifa = d.get("seifa")
    if not isinstance(seifa, dict) or len(seifa) != 47:
        fail(f"SEIFA store covers {len(seifa or {})} districts, expected 47")
    for name, row in seifa.items():
        for ix in ("irsad", "irsd", "ier", "ieo"):
            c = (row or {}).get(ix) or {}
            if not (isinstance(c.get("v"), (int, float)) and isinstance(c.get("dec"), int)
                    and isinstance(c.get("pct"), (int, float))):
                fail(f"SEIFA store: {name}.{ix} lacks a {{v, pct, dec}} cell — rerun build_sa26_seifa.py")
    return seifa


def main():
    os.makedirs(OUT, exist_ok=True)
    ha = fetch("ecsa-ha", f"HAStatic/{ELECTION}")
    hc = fetch("ecsa-hac", f"HAChange/{ELECTION}/0")
    if ha.get("electionDate") != ELECTION or hc.get("electionDate") != ELECTION:
        fail("election dates disagree with the expected 2026-03-21")
    if hc.get("electionStatus") != "final":
        fail(f"electionStatus is {hc.get('electionStatus')!r}, expected final — not ready to file")

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
    for di, name in enumerate(names):
        s = ha_d[name]
        c = hc_d[name]

        # ---- candidates: static is the roster, the change file the count ----
        s_cands = {cd["candidateId"]: cd for cd in s["candidates"]}
        c_cands = {cd["candidateId"]: cd for cd in c["candidates"]}
        if set(s_cands) != set(c_cands):
            fail(f"{name}: candidate id sets differ ({sorted(set(s_cands) ^ set(c_cands))})")

        # formal per candidate: polling places + declaration piles + the
        # absent-ordinary lane (absentees' ordinary votes, counted with the
        # district but reported apart from the polling places)
        formal = collections.Counter()
        for pp in c["pollingPlaces"]:
            for pc in pp["pollingCandidates"]:
                formal[pc["candidateId"]] += pc["formalVotes"]
        decl_f = decl_i = 0
        for dec in c["declarations"]:
            decl_f += dec["formalVotes"]
            decl_i += dec["informalVotes"]
            for cv in dec["candidateVotes"]:
                formal[cv["candidateId"]] += cv["votes"]
        ordinary = dict(formal)
        absent_f = absent_i = 0
        for ab in c.get("absentOrdinary") or []:
            absent_f += ab["formalVotes"]
            absent_i += ab["informalVotes"]
            for cv in ab["candidateVotes"]:
                formal[cv["candidateId"]] += cv["votes"]
        for cid in formal:
            if cid not in s_cands:
                fail(f"{name}: vote count for unknown candidate {cid}")
        # the API's own per-candidate totals must equal the pp+decl part
        for cid, cc in c_cands.items():
            own = (cc.get("ordinaryVotes") or 0) + (cc.get("declarationVotes") or 0)
            if own != ordinary.get(cid, 0):
                fail(f"{name}: candidate {cid} api total {own} != composed {ordinary.get(cid, 0)}")
        pp_f = sum(pc["formalVotes"] for pp in c["pollingPlaces"] for pc in pp["pollingCandidates"])
        pp_i = sum(pp["informalVotes"] for pp in c["pollingPlaces"])
        if sum(ordinary.values()) != pp_f + decl_f:
            fail(f"{name}: ordinary composition {sum(ordinary.values())} != {pp_f}+{decl_f}")
        if sum(formal.values()) != pp_f + decl_f + absent_f:
            fail(f"{name}: formal composition {sum(formal.values())} != {pp_f}+{decl_f}+{absent_f}")
        if c["informalDeclarationVotes"] != decl_i:
            fail(f"{name}: informal declaration votes {c['informalDeclarationVotes']} != declaration piles' informal {decl_i}")
        informal = pp_i + c["informalDeclarationVotes"] + absent_i

        # ---- the final pair and the winner -------------------------------
        # the distribution names ECSA's global candidate ids while every other
        # lane uses the per-district roster — join on candidate-name tokens
        def toks(nm):
            return tuple(sorted("".join(ch.lower() if ch.isalpha() else " " for ch in (nm or "")).split()))
        local_by_toks = {}
        for cid, cd in s_cands.items():
            k = toks(cd["candidateName"])
            if k in local_by_toks:
                fail(f"{name}: candidate names collide ({cd['candidateName']!r} vs {s_cands[local_by_toks[k]]['candidateName']!r})")
            local_by_toks[k] = cid
        rounds = c["finalDistribution"]
        if not rounds:
            fail(f"{name}: no preference distribution")

        def fd_map(round_):
            out = {}
            for r in round_["candidateResults"]:
                cid = local_by_toks.get(toks(r.get("candidateName")))
                if cid is None:
                    fail(f"{name}: distribution candidate {r.get('candidateName')!r} not on the static roster")
                out[cid] = r
            if len(out) != len(s_cands):
                fail(f"{name}: distribution round lists {len(out)} candidates, static roster has {len(s_cands)}")
            return out

        first, last = fd_map(rounds[0]), fd_map(rounds[-1])
        fd_formal = 0
        for cid, r in first.items():
            fd_formal += r["voteChange"]
            if abs(r["voteChange"] - formal.get(cid, 0)) > DRIFT_MAX:
                fail(f"{name}: {s_cands[cid]['candidateName']}: distribution first preferences {r['voteChange']} vs lanes {formal.get(cid, 0)} — beyond check-count drift")
        if abs(fd_formal - sum(formal.values())) > DRIFT_MAX:
            fail(f"{name}: distribution formal {fd_formal} vs lanes formal {sum(formal.values())} — beyond check-count drift")
        live = [cid for cid, r in last.items() if not r["isExcluded"] and r["progressiveTotal"] is not None]
        elected = [cid for cid, r in last.items() if r["isElected"]]
        if len(live) != 2:
            fail(f"{name}: final round has {len(live)} live candidates, expected 2")
        if len(elected) != 1:
            fail(f"{name}: {len(elected)} elected candidates in the final round, expected 1")
        if elected[0] not in live:
            fail(f"{name}: the elected candidate is not one of the final pair")
        prog_sum = sum(r["progressiveTotal"] for r in last.values() if r["progressiveTotal"] is not None)
        if prog_sum != fd_formal:
            fail(f"{name}: final-round progressive totals {prog_sum} != check-count formal {fd_formal}")

        # ---- rows ----
        rows = []
        for cid, cd in s_cands.items():
            nm = cd["candidateName"]
            if "," in nm:
                sur, giv = nm.split(",", 1)
                nm = title_name(giv, sur)
            rows.append({"cid": cid, "n": nm, "ab": cd["partyId"] or "IND", "pn": cd["partyName"] or "Independent",
                         "b": bucket(cd["partyId"]), "v": formal.get(cid, 0), "el": cid == elected[0]})
        rows.sort(key=lambda r: -r["v"])
        w = next(r for r in rows if r["el"])
        seats[w["ab"]] += 1

        pair_buckets = {bucket(s_cands[l]["partyId"]) for l in live}
        tpp = None
        if pair_buckets == {"alp", "lnp"}:
            alp_l = next(l for l in live if bucket(s_cands[l]["partyId"]) == "alp")
            lnp_l = next(l for l in live if l != alp_l)
            tpp = [last[alp_l]["progressiveTotal"], last[lnp_l]["progressiveTotal"], None]
            tpp_tot[0] += tpp[0]
            tpp_tot[1] += tpp[1]

        cid2row = {r["cid"]: k for k, r in enumerate(rows)}
        tcp = [[cid2row[live[0]], last[live[0]]["progressiveTotal"]],
               [cid2row[live[1]], last[live[1]]["progressiveTotal"]]]

        enrolled = s.get("districtEnrolled") or 0
        rec = {
            "id": di, "n": name, "st": "SA",
            "c": [[r["n"], r["ab"], r["pn"], r["b"], r["v"], 0, 1 if r["el"] else 0, 0] for r in rows],
            "inf": informal,
            "tcp": tcp,
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
    out = {"year": "sa26", "date": ELECTION, "prev": None, "jurisdiction": "SA", "demoBasis": "sa1",
           "agg": {"AUS": agg, "SA": dict(agg)}, "divs": D}
    p = os.path.join(OUT, "data-sa26.json")
    with open(p, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    tp = 100 * tpp_tot[0] / (tpp_tot[0] + tpp_tot[1])
    print("sa26 districts", len(D), "| seats", dict(seats), "| 2PP-classic ALP", round(tp, 2),
          "| informal", round(100 * tot_inf / (tot_inf + tot_formal), 2), "| enrolled", tot_enrolled,
          "->", os.path.getsize(p), "bytes")


main()
