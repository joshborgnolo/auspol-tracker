#!/usr/bin/env python3
"""data-now-wa.json for /map/ — the "WA now" overlay: the 2025 Legislative
Assembly with the Secret Harbour by-election since polling day 2025-03-08,
in the shape of the federal/nsw data-now files (applyNow's contract).

Events (formal announcements checked against the WAEC media releases and
the press coverage; by-election results from the EIS ByElections overview
mirrored by .build/map/harvest-wa-byelections.py at
.build/state-flow-src/wa/byelections/2026-secret-harbour/overview.json —
same one-family shape as the general-election district payloads):
  Paul Papalia (ALP, Secret Harbour) retired from Parliament
  on 6 July 2026 (messages of 13 July's writ-issue release called him
  "the former Member for Secret Harbour") — Writ 13 July 2026
  Secret Harbour by-election, 29 August 2026 — Luke Herdegen (One
  Nation) won 15,851-11,864 on the final pair over Labor's Georgia Tree
  (One Nation's first Western Australian lower-house seat)

Records (applyNow's data-now contract; modelled on build_nsw_now.py):
  changes[]  the two hand-curated member events above
  holders{}  who sits for Secret Harbour today
  byelections{} district -> {date, event, div, booths, formal, informal,
             turnout, enrolment, lapsed2025}; the div a deriveDiv-shaped
             record on the wa25 frame (candidates sorted by votes, tcp the
             final pair's district totals, tpp None — One Nation's special
             pair is no classic ALP-v-Coalition lane, fl [] the frame's
             own convention, h the wa25 history row + the by-election row),
             demo/seifa carried from the 2025 base record; booths spliced
             by applyNow over the wa25 lane with the overview's own venue
             coordinates (the WANow never rides the base roll), prev = the
             wa25 same-name booth for the same-place swing read

usage: python3 -I .build/map/build_wa_now.py
"""
import collections
import json
import os
import re

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
RES25 = os.path.join(REPO, "map", "data", "data-wa25.json")
SRC = os.path.join(REPO, ".build", "state-flow-src", "wa",
                   "byelections", "2026-secret-harbour", "overview.json")
OUT = os.path.join(REPO, "map", "data", "data-now-wa.json")
#: ISO day the overlay speaks of (its sibling files' shape); the banner reads
#: "The Legislative Assembly as it stands, <longDate(asOf)>"
AS_OF = "2026-11-05"
BASE_YEAR = 2025
BY_YEAR = 2026
BY_DATE = "2026-08-29"
EVENT = "2026 Secret Harbour By-Election"
DIST = "Secret Harbour"

CHANGES = [
    {"div": DIST, "date": "2026-07-06", "kind": "resigned", "who": "Paul Papalia",
     "from": "ALP", "to": None,
     "text": "Paul Papalia announced his retirement from Parliament "
             "(resignation effective by the Secret Harbour writ of 13 July 2026)"},
    {"div": DIST, "date": BY_DATE, "kind": "by-election", "who": "Luke Herdegen",
     "from": None, "to": "ONP",
     "text": "Luke Herdegen won the Secret Harbour by-election for One Nation"},
]
HOLDERS = {DIST: {"n": "Luke Herdegen", "ab": "ONP"}}
# the counts sit in the app's fam space (lnp = the Liberals and The Nationals
# WA alike; onp the One Nation seat)
EXPECTED_CHAMBER = {"alp": 45, "lnp": 13, "onp": 1}

def fail(msg):
    raise SystemExit(f"build-wa-now: {msg}")


def sur_case(s):
    """'HART -> 't Hart, O'MALLEY -> O'Malley, MURRAY-WELLINGTON -> Murray-Wellington."""
    low = s.lower()
    for lead in ("'t ", "de ", "van ", "la ", "di ", "d'"):
        if low.startswith(lead):
            return lead + s[len(lead):].title()
    return s.title()


def bucket(ab):
    return {"ALP": "alp", "LIB": "lnp", "NAT": "lnp", "NATS": "lnp",
            "GRN": "grn", "PHON": "onp", "ONP": "onp"}.get(
        ab, "ind" if ab in ("IND", "") else "oth")


def norm_key(s):
    return re.sub(r"[^A-Z0-9]+", " ", str(s or "").upper()).strip()


def bn(v):
    return int(str(v or "0").replace(",", ""))


def main():
    base = json.load(open(RES25))
    by_name = {d["n"]: i for i, d in enumerate(base["divs"])}
    if DIST not in by_name:
        fail(f"{DIST}: not a district of wa{BASE_YEAR % 100}")
    bi = by_name[DIST]
    bdiv = base["divs"][bi]
    if not os.path.exists(SRC):
        fail(f"by-election mirror {SRC} missing — run .build/map/harvest-wa-byelections.py")
    ov = json.load(open(SRC))

    ev = ov["ElectionEvent"]
    by_date = str(ev["ELECTION_DATE"])[:10]
    if by_date != BY_DATE:
        fail(f"mirror says ELECTION_DATE {by_date}, ledger says {BY_DATE}")
    tt = ov["toptotals"]
    formal, informal, enrolled = (tt["FORMAL_LAST_PUBLISHED_NUMBER_ENTERED"],
                                  tt["INFORMAL_LAST_PUBLISHED_NUMBER_ENTERED"], tt["NUMBER_ELECTORS"])

    # the by-election's own candidate roll carries "SURNAME, Given" names and
    # its party long names ("One Nation", "Liberal Party" — themselves the
    # registered forms, read verbatim, never re-typed)
    roster = {}
    for rc in ov["districtCandidates"]:
        bp, pa = rc["BALLOT_PAPER_NAME"], rc["PARTY_AFFILIATION"]
        if "," in bp:
            sur0, given = bp.split(",", 1)
            disp = f"{given.strip()} {sur_case(sur0.strip())}"
        else:
            sur0, disp = bp, sur_case(bp.strip())
        roster[norm_key(sur0)] = (disp, pa)
    if len(roster) != 16:
        fail(f"districtCandidates holds {len(roster)} rows (want 16)")

    cands = []
    for c in ov["resultsCandidates"]:
        sur, ab = c["BALLOT_PAPER_NAME"], c["PARTY_AFFILIATION"]
        hit = roster.get(norm_key(sur))
        if hit is None:
            fail(f"results candidate {sur!r} isn't on the districtCandidates roll")
        disp, pa = hit
        cands.append({"key": norm_key(sur), "sur": sur.replace("'", ""), "ab": ab,
                      "n": disp, "pn": pa or "Independent", "b": bucket(ab),
                      "v": bn(c["Votes_Counted"]),
                      "ord": c["Ballot_Paper_Order"]})

    tcp_rows = ov["results2CP"]
    if len(tcp_rows) != 2:
        fail("results2CP not a pair")

    pseudo_results = re.compile(r"^(Absent Votes|Postal Votes|Provisional Votes|"
                                r"Mobile Polling|Special Institutions|Deleted Votes)$", re.I)
    venue_regs = {}
    for sec in ("districtPollingPlaces", "earlyPollingPlaces", "earlyPollingPlacesOther"):
        for v in ov.get(sec) or []:
            venue_regs[norm_key(v["VENUE_NAME"])] = v
    early_names = {norm_key(v["VENUE_NAME"]) for v in ov.get("earlyPollingPlaces") or []}
    venue_rows = []
    for r in ov["resultsPollingPlace"]:
        nm = r["BREAKDOWN_NAME"].strip()
        if pseudo_results.match(nm):
            continue
        votes = [bn(r.get(f"{a['sur']} - {a['ab']}") if a["ab"] else bn(r.get(a["sur"])))
                 for a in cands]
        tot, inf = bn(r.get("Total Votes")), bn(r.get("Informal"))
        if sum(votes) + 0 != tot - inf and tot:
            fail(f"{nm}: candidate sum {sum(votes)} != row formal {tot - inf}")
        rec = venue_regs.get(norm_key(nm))
        ty = 5 if norm_key(nm) in early_names else 1
        venue_rows.append({"name": nm, "votes": votes, "inf": inf, "rec": rec, "ty": ty})
    if len(venue_rows) < 5:
        fail(f"only {len(venue_rows)} real venues in the by-election roll")

    # candidates were read in ballot order; emit vote-sorted like every other record
    rows = sorted(cands, key=lambda r: -r["v"])
    by_nm = {r["key"]: k for k, r in enumerate(rows)}
    pair = []
    for tr in tcp_rows:
        sur, _ab = tr["Ballot_Paper_Name"].rsplit(" - ", 1)
        k = norm_key(sur)
        if k not in by_nm:
            fail(f"2CP finalist {tr['Ballot_Paper_Name']} off the roster")
        pair.append([by_nm[k], bn(tr["Votes_Counted"])])
    win_i = pair[0][0] if pair[0][1] > pair[1][1] else pair[1][0]
    winner = rows[win_i]
    if winner["sur"].replace(" ", "") != "HERDEGEN" or winner["ab"] != "PHON":
        fail(f"2CP winner {winner['sur']} ({winner['ab']}) disagrees with the ledger "
             "(Luke Herdegen, One Nation)")
    if HOLDERS[DIST]["n"] != "Luke Herdegen":
        fail("holder ledger drifted")
    # One Nation's special pair: no classic ALP-v-Coalition tpp lane
    winsur = norm_key(next(r for r in rows if r is winner or (r["key"] == winner["key"] and r["ab"] == winner["ab"]))["key"])
    D = {
        "id": bdiv["id"], "n": bdiv["n"], "st": "WA",
        "c": [[r["n"], r["ab"], r["pn"], r["b"], r["v"], None,
               1 if r["key"] == winsur else 0, 0] for r in rows],
        "inf": informal,
        "tcp": pair,
        "fl": [],
        "h": bdiv["h"] + [[BY_YEAR, None, "ONP", "Luke Herdegen", "by"]],
        "enrolled": enrolled,
        "demo": bdiv.get("demo"),
        "seifa": bdiv.get("seifa"),
    }

    Bb = {k: [] for k in ("d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon",
                          "v", "inf", "tpp", "tcp", "fl", "dec", "vdec", "prev")}
    B25 = base["booths"]
    keep25 = {}
    for j in range(len(B25["id"])):
        if B25["d"][j] == bi:
            keep25[norm_key(B25["n"][j])] = j
    for i2, r in enumerate(venue_rows):
        rec = r["rec"] or {}
        lat0, lon0 = rec.get("LATITUDE"), rec.get("LONGITUDE")
        Bb["d"].append(0)
        Bb["id"].append(f"wanow-{bi}-{i2}")
        Bb["n"].append(r["name"])
        Bb["ty"].append(r["ty"])
        Bb["prem"].append(rec.get("FULL_FORMAT_PHYSICAL_ADDRESS") or None)
        Bb["sub"].append(rec.get("PHYSICAL_LOCALITY") or None)
        Bb["pc"].append(None)
        Bb["lat"].append(round(float(lat0), 5) if lat0 else None)
        Bb["lon"].append(round(float(lon0), 5) if lon0 else None)
        Bb["v"].append(r["votes"])
        Bb["inf"].append(r["inf"])
        Bb["tpp"].append(None)
        Bb["tcp"].append(None)
        Bb["fl"].append(None)
        Bb["dec"].append(None)
        Bb["vdec"].append(None)
        Bb["prev"].append(keep25.get(norm_key(r["name"])))

    lapsed = [B25["n"][j] for j in keep25.values() if norm_key(B25["n"][j]) not in
              {norm_key(r["name"]) for r in venue_rows}]
    out = {
        "asOf": AS_OF,
        "changes": CHANGES,
        "holders": HOLDERS,
        "byelections": {
            DIST: {
                "date": BY_DATE, "event": EVENT, "div": D, "booths": Bb,
                "formal": formal, "informal": informal,
                "turnout": formal + informal, "enrolment": enrolled,
                "lapsed2025": lapsed,
            },
        },
    }
    got = collections.Counter(c[3] for d in base["divs"] for c in d["c"] if c[6] == 1)
    winner_b = "onp" if winner["ab"] in ("PHON", "ONP") else bucket(winner["ab"])
    base_winner_b = next(c[3] for c in bdiv["c"] if c[6] == 1)
    got[winner_b] += 1
    got[base_winner_b] -= 1
    got_map = {k: v for k, v in got.items() if v}
    if got_map != EXPECTED_CHAMBER:
        fail(f"chamber after by-election {got_map} != expected {EXPECTED_CHAMBER}")
    print(f"{DIST}: {BY_DATE} formal {formal} informal {informal} "
          f"turnout {formal + informal} ({100 * (formal + informal) / enrolled:.1f}%) "
          f"| {len(venue_rows)} booths | Luke Herdegen (ONP) {pair} | lapsed2025 {lapsed}")
    print(f"chamber after by-elections: {got_map}")
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"wa-now -> {OUT} ({os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
