"""data-now-qld.json for /map/ — the "Qld now" overlay: the 2024 Queensland
Legislative Assembly with the two by-elections since polling day
2024-10-26, in the shape of the federal data-now.json (applyNow's contract).

Events (the ECQ's Vote Result System media feed, mirrored by
.build/harvest-qld-byelections.py at .build/state-flow-src/qld/byelections/;
each zip bundles that day's companion council by-election, so the parse
filters to the State By-election's own districts):
  Hinchinbrook  29 November 2025 — Nick Dametto (KAP) resigned;
                Wayde Chiesa's Liberal National gain from KAP
  Stafford      16 May 2026 — Jimmy Sullivan expelled from Queensland
                Labor (12 May 2025, sat as an independent), died 9 April 2026;
                Luke Richmond's Labor keep
(Queensland's Gympie seat never came vacant — Tony Perrett held it.)

Grammar (publicResults.xml, checked against both feeds):
  <venues>: the event roll — REAL venues with lat/lon, locality, postcode,
    streetName/streetNo, buildingName (premises) — self-sufficient; nothing
    rides the 2024 roll for coordinates
  <election eventType="State By-election"> — exactly one per event file
    (the council by-election sits beside it), holding the day, one
    <district> (enrolment), <candidates> (ballotOrderNumber, party/partyCode),
    <declaredCandidate>, and count rounds:
      preliminary="NO" preferences="NO" — the official count: totals and a
        <booths> block of per-candidate counts per row; PB and EV rows and
        the pseudo rows ride it (typeCodes DV1/DV2/AB1/AB2 plus roving
        teams naming Mobile Polling/declared institutions and the
        Telephone Voting rows riding PB/EV codes)
      preferences="YES" — the official distribution: twoCandidateVotes at
        district and booth, and the <preferenceDistributionSummary> chain —
        Queensland's compulsory preferential count, exhaust 0 every round
  (qld_ecq.py's own SGE parse is the grammar's authority; this builder
   reads the same shapes by hand because each feed is one district's own.)

Records (applyNow's data-now contract):
  changes[]  hand-curated member events (Labor's expulsion of Jimmy
             Sullivan, Nick Dametto's resignation, Sullivan's death, the
             two by-election wins)
  holders{}  who sits for each district today
  byelections{}  district -> {date, ecqEvent, div, booths, formal,
             informal, turnout, enrolment, lapsed2024}; the div a
             deriveDiv-shaped record on the qld frame (candidates sorted by
             votes, tcp the final pair's district totals, tpp only where
             the pair is ALP v LNP (Stafford), fl the counted distribution
             chain's transfers to the pair (Stafford; [] on Hinchinbrook's
             LNP-v-KAP final), h the base history + the by-election row,
             demo/seifa carried from the 2024 base record); booths spliced
             by applyNow over the 2024 lane with the media feed's own venue
             attributes (premises from its roll), prev = the 2024 same-name
             booth for the same-place swing read

usage: python3 -I .build/map/build_qld_now.py
"""
import collections
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
CACHE = os.path.join(REPO, ".build", "state-flow-src", "qld", "byelections")
RES_QLD24 = os.path.join(REPO, "maps", "data", "res-qld24.json")
OUT = os.path.join(REPO, "maps", "data", "data-now-qld.json")
sys.path.insert(0, os.path.join(REPO, ".build", "map"))
import qld_ecq  # the feed grammar's authority — helpers only (names, party
                 # codes, the venue roll, pseudo-lane vocab, booth types)

AS_OF = "2026-11-04"
EVENTS = {
    "Hinchinbrook": {"stub": "Hinchinbrook2025", "day": "2025-11-29"},
    "Stafford": {"stub": "Stafford2026", "day": "2026-05-16"},
}
# every change in the Legislative Assembly since 26 October 2024 (dates:
# Queensland Labor's caucus meeting (Brisbane Times, 12 May 2025), the
# Parliament's vacancy records, the ECQ's declarations)
CHANGES = [
    {"div": "Stafford", "date": "2025-05-12", "kind": "left", "who": "Jimmy Sullivan", "from": "ALP", "to": "IND",
     "text": "Jimmy Sullivan was expelled from Queensland Labor and sat as an independent"},
    {"div": "Hinchinbrook", "date": "2025-10-14", "kind": "resigned", "who": "Nick Dametto", "from": "KAP", "to": None,
     "text": "Nick Dametto resigned from Parliament"},
    {"div": "Hinchinbrook", "date": "2025-11-29", "kind": "by-election", "who": "Wayde Chiesa", "from": None, "to": "LNP",
     "text": "Wayde Chiesa won the by-election for the Liberal National Party"},
    {"div": "Stafford", "date": "2026-04-09", "kind": "died", "who": "Jimmy Sullivan", "from": "IND", "to": None,
     "text": "Jimmy Sullivan died in office"},
    {"div": "Stafford", "date": "2026-05-16", "kind": "by-election", "who": "Luke Richmond", "from": None, "to": "ALP",
     "text": "Luke Richmond won the by-election for Labor"},
]
HOLDERS = {
    "Hinchinbrook": {"n": "Wayde Chiesa", "ab": "LNP"},
    "Stafford": {"n": "Luke Richmond", "ab": "ALP"},
}
# labels the newer event prints where ECQ renamed its own channel: their
# 2024 companion row, proven same-place by shared premises (the Returning
# Officer IS the district's early-voting TŪTO office the 2024 frame prints
# "Ingham Early Voting Centre" — 73-75 Mcilwraith St, Ingham both times)
VENUE_ALIASES = {
    "Hinchinbrook": {"Returning Officer Hinchinbrook": "Ingham Early Voting Centre"},
}
# event venues the base election never printed (each verified against the
# ECQ roll and the feed's own attributes carried — Chermside South's 2026
# early window opened at the Kedron community church where '24s day booth
# also sits; it is a different channel and never takes a prevFp join)
VENUE_NEW = {
    "Stafford": {"Chermside South Early Voting Centre"},
}
EXPECTED_CHAMBER = {"alp": 36, "lnp": 53, "grn": 1, "ind": 1, "oth": 2}


def fail(msg):
    raise SystemExit(f"qld-now: {msg}")


def num(s):
    s = (s or "").replace(",", "").strip()
    return int(s) if re.fullmatch(r"-?\d+", s) else None


def suburb_case(s):
    t = (s or "").strip().title()
    return re.sub(r"\bMc([a-z])", lambda m: "Mc" + m.group(1).upper(), t)


def read_cache(stub):
    p = os.path.join(CACHE, stub, "xml", "publicResults.xml")
    if not os.path.exists(p):
        fail(f"cache {p} missing — run .build/harvest-qld-byelections.py")
    return ET.parse(p).getroot()


def text_count(el, *paths):
    for pth in paths:
        n = num(el.findtext(pth))
        if n is not None:
            return n
    return None


def load_event(root, dist):
    """One State By-election's district: candidates, totals, venue rows,
    the TCP pair and the counted chain — qld_ecq's SGE grammar in one feed."""
    els = [e for e in root.findall("election")
           if (e.get("eventType") or "") == "State By-election"]
    if len(els) != 1:
        fail(f"{dist}: {len(els)} state by-election blocks, expected 1")
    el = els[0]
    venues, _ = qld_ecq.vrs_venues(root)
    blocks = [d for d in el.find("districts").findall("district")
              if (d.get("districtName") or "") == dist]
    if len(blocks) != 1:
        have = [d.get("districtName") for d in el.find("districts").findall("district")]
        fail(f"{dist}: district not in the State By-election block (it prints {have})")
    d = blocks[0]
    name = d.get("districtName")
    enrolled = int(d.get("enrolment") or 0)
    day = el.get("electionDay")
    cands, keys = [], set()
    for c in d.find("candidates").findall("candidate"):
        bo = c.get("ballotOrderNumber")
        if not bo:
            fail(f"{name}: candidate without ballotOrderNumber")
        cands.append({"key": bo, "n": qld_ecq.ballot_to_name(c.get("ballotName") or ""),
                      "ab": qld_ecq.code_ab(c.get("partyCode") or c.get("party") or ""),
                      "pn": c.get("party") or ""})
        if bo in keys:
            fail(f"{name}: ballotOrderNumber {bo} duplicated")
        keys.add(bo)
    decl = d.find("declaredCandidate")
    if decl is None or not decl.get("ballotOrderNumber"):
        fail(f"{name}: no declaredCandidate marker")
    elected = decl.get("ballotOrderNumber")
    if elected not in keys:
        fail(f"{name}: declaredCandidate is no roster key")

    fpv_round = dop_round = None
    for cr in d.findall("countRound"):
        if (cr.get("preferences") or "") == "YES":
            dop_round = cr
        elif (cr.get("preliminary") or "") == "NO":
            fpv_round = cr
    if fpv_round is None or dop_round is None:
        fail(f"{name}: official FPV and/or preference rounds missing")

    def row_counts(row, tag="primaryVoteResults"):
        blk = row.find(tag) if tag else row
        out = {}
        for c in blk.findall("candidate"):
            out[c.get("ballotOrderNumber")] = int(c.findtext("count") or 0)
        return out

    fpv = row_counts(fpv_round)
    formal = text_count(fpv_round, "totalFormalVotes/count", "totalFormalVotes")
    informal = text_count(fpv_round, "totalInformalVotes/count", "totalInformalBallots/count",
                          "totalInformalVotes", "totalInformalBallots")
    turnout = text_count(fpv_round, "totalVotes", "totalBallots")
    if formal is None or informal is None:
        fail(f"{name}: FPV totals missing (formal {formal}, informal {informal})")
    if turnout is None or turnout == 0:
        turnout = formal + informal
    if sum(fpv.values()) != formal:
        fail(f"{name}: FPV candidates {sum(fpv.values())} != formal {formal}")
    if set(fpv) != keys:
        fail(f"{name}: FPV candidate keys differ from the roster")
    pair = qld_ecq.dop_pair(dop_round)
    pair_keys = list(pair)
    if set(pair_keys) - keys:
        fail(f"{name}: a final TCP candidate is off the roster")
    if abs(sum(pair.values()) - formal) > formal * 0.02:
        fail(f"{name}: TCP totals {sum(pair.values())} drift from formal {formal}")

    # venue rows: real booths vs the lump-rows (qld_ecq's pseudo vocab)
    tcp_by_id = {}
    db = dop_round.find("booths")
    if db is not None:
        for b in db.findall("booth"):
            tcp_by_id[b.get("id")] = row_counts(b, "twoCandidateVotes")
    booths = []
    fb = fpv_round.find("booths")
    if fb is None:
        fail(f"{name}: FPV round carries no booths block")
    lump_formal = lump_inf = 0
    for b in fb.findall("booth"):
        bid = b.get("id")
        tcode = (b.get("typeCode") or "").upper()
        bname = b.get("name") or ""
        bformal = int(b.findtext("formalVotes") or 0)
        binf = int(b.findtext("informalVotes") or 0)
        pv = row_counts(b)
        if sum(pv.values()) != bformal:
            fail(f"{name}: booth {bname!r} candidate sum {sum(pv.values())} != its formal {bformal}")
        if tcode in qld_ecq.PSEUDO_TYPE or qld_ecq.pseudo_borrowed_name(bname):
            lump_formal += bformal
            lump_inf += binf
            continue
        ty = qld_ecq.BOOTH_TY.get((tcode, False))
        if ty is None:
            fail(f"{name}: booth {bname!r} typeCode {tcode!r} unmapped")
        v = venues.get(bid)
        if v is None or v["lat"] is None:
            if not re.search(r"(?i)mobile|declared institution", bname):
                fail(f"{name}: booth {bname!r} has no geocoded venue record and is no mobile team")
            ty = 4
            v = None
        tc = tcp_by_id.get(bid)
        tcp = None
        if tc is not None:
            if set(tc) != set(pair_keys):
                fail(f"{name}: booth {bname!r} TCP pair {sorted(tc)} != the district's final pair")
            if sum(tc.values()) > bformal:
                fail(f"{name}: booth {bname!r} TCP sum {sum(tc.values())} exceeds its formal")
            tcp = [tc[pair_keys[0]], tc[pair_keys[1]]]
        booths.append({"name": bname, "ty": ty, "venue": v,
                       "formal": bformal, "informal": binf,
                       "pv": pv, "tcp": tcp})
    lane_f = sum(b["formal"] for b in booths)
    lane_i = sum(b["informal"] for b in booths)
    if lane_f + lump_formal != formal or lane_i + lump_inf != informal:
        fail(f"{name}: lane+declaration formal {lane_f}+{lump_formal}/{lane_i}+{lump_inf} "
             f"!= district {formal}+{informal}")

    # the counted chain: each exclusion's transfers to the eventual pair
    fl = []
    pds = dop_round.find("preferenceDistributionSummary")
    if pds is not None:
        for xe in pds.findall("preferenceDistribution"):
            excl = xe.get("excludedBallotOrder")
            if not excl:
                fail(f"{name}: a distribution names no excluded candidate")
            counts = {}
            for cp in xe.findall("candidatePreferences") + xe.findall("preferenceCount"):
                k = cp.get("ballotOrderNumber")
                n = num(cp.findtext("count"))
                if k is None:
                    n = num(cp.get("count"))
                if k is not None and n is not None:
                    counts[k] = n
            toA = counts.get(pair_keys[0], 0)
            toB = counts.get(pair_keys[1], 0)
            if toA or toB:
                fl.append((excl, toA, toB))

    return {"name": name, "day": day, "enrolled": enrolled, "cands": cands,
            "elected": elected, "fpv": fpv, "formal": formal, "informal": informal,
            "turnout": turnout, "booths": booths, "pair_keys": pair_keys,
            "pair": pair, "flows": fl}


def main():
    with open(RES_QLD24) as f:
        base = json.load(f)
    by_display = {d["n"]: i for i, d in enumerate(base["divs"])}
    for d in EVENTS:
        if d not in by_display:
            fail(f"{d}: not a district of the 2024 frame")
    B24 = base["booths"]
    n24 = len(B24["id"])
    prev_idx = {}
    for i, d in enumerate(base["divs"]):
        cell = {}
        for j in range(n24):
            if B24["d"][j] == i:
                if B24["n"][j] in cell:
                    fail(f"base frame prints booth {B24['n'][j]!r} twice in {d['n']}")
                cell[B24["n"][j]] = j
        prev_idx[d["n"]] = cell

    out = {"asOf": AS_OF, "changes": CHANGES, "holders": HOLDERS, "byelections": {}}
    seats = collections.Counter()
    for d in base["divs"]:
        w = next(c for c in d["c"] if c[6] == 1)
        seats[qld_ecq.bucket(w[1])] += 1
    base_total = dict(sorted(seats.items()))
    expected_2024 = {"alp": 36, "grn": 1, "ind": 1, "lnp": 52, "oth": 3}
    if base_total != expected_2024:
        fail(f"the 2024 frame's seats are {base_total}, not {expected_2024} — fix the ledger assumptions")

    for dist, e in EVENTS.items():
        ev = load_event(read_cache(e["stub"]), dist)
        # candidates in the res schema's vote-descending order
        rows = []
        for c in ev["cands"]:
            rows.append({"cid": c["key"], "key": c["key"], "n": c["n"], "ab": c["ab"],
                         "pn": c["pn"], "v": ev["fpv"][c["key"]]})
        rows.sort(key=lambda r: -r["v"])
        key2row = {r["key"]: i for i, r in enumerate(rows)}
        elected_key = ev["elected"]
        if elected_key not in key2row:
            fail(f"{dist}: declared candidate is off the sorted roster")
        wi = key2row[elected_key]
        winner, win_ab = rows[wi]["n"], rows[wi]["ab"]
        if winner != HOLDERS[dist]["n"] or win_ab != HOLDERS[dist]["ab"]:
            fail(f"{dist}: the feed's declared winner {winner} ({win_ab}) disagrees with the hand ledger")
        pair_i0 = key2row[ev["pair_keys"][0]]
        pair_i1 = key2row[ev["pair_keys"][1]]
        tcp_pair = [[pair_i0, ev["pair"][ev["pair_keys"][0]]], [pair_i1, ev["pair"][ev["pair_keys"][1]]]]
        pb = {qld_ecq.bucket(rows[pair_i0]["ab"]), qld_ecq.bucket(rows[pair_i1]["ab"])}
        tpp = None
        if pb == {"alp", "lnp"}:
            if qld_ecq.bucket(rows[pair_i0]["ab"]) == "alp":
                va, vb = ev["pair"][ev["pair_keys"][0]], ev["pair"][ev["pair_keys"][1]]
            else:
                va, vb = ev["pair"][ev["pair_keys"][1]], ev["pair"][ev["pair_keys"][0]]
            tpp = [va, vb, None]
        fl = []
        if pb == {"alp", "lnp"}:
            for excl, toA, toB in ev["flows"]:
                ci = key2row.get(excl)
                if ci is None:
                    fail(f"{dist}: a flow transfer names no roster candidate ({excl!r})")
                fl.append([ci, toA, toB])

        keep24 = prev_idx[dist]
        bi = by_display[dist]
        bdiv = base["divs"][bi]
        D = {
            "id": bdiv["id"], "n": bdiv["n"], "st": "QLD",
            "c": [[r["n"], r["ab"], r["pn"] or "", qld_ecq.bucket(r["ab"]), r["v"], None,
                   1 if r["key"] == elected_key else 0, 0] for r in rows],
            "inf": ev["informal"], "tcp": tcp_pair, "fl": fl,
            "h": bdiv["h"] + [[int(e["day"][:4]), None, win_ab, winner, "by"]],
            "enrolled": ev["enrolled"],
            "demo": bdiv.get("demo"), "seifa": bdiv.get("seifa"),
        }
        if tpp:
            D["tpp"] = tpp
        Bb = {k: [] for k in ("d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon",
                              "v", "inf", "tpp", "tcp", "fl", "dec", "vdec", "prev")}
        labs = set()
        for i2, b in enumerate(ev["booths"]):
            nm = b["name"]
            if nm in labs:
                fail(f"{dist}: the feed prints {nm!r} twice after labelling")
            labs.add(nm)
            v = b["venue"]
            votes = [0] * len(rows)
            for c in rows:
                votes[key2row[c["key"]]] = b["pv"][c["key"]]
            if b["formal"] != sum(votes):
                fail(f"{dist}: booth {nm!r} formal fails after re-indexing")
            prev = keep24.get(nm)
            alias_of = None
            if prev is None and nm in VENUE_ALIASES.get(dist, {}):
                alias_of = VENUE_ALIASES[dist][nm]
                prev = keep24.get(alias_of)
            if prev is None:
                if nm not in VENUE_NEW.get(dist, set()):
                    fail(f"{dist}: venue {nm!r} is not one of the 2024 frame's venues "
                         f"(rename, move, or event venue the 24 count never printed — hand-map first)")
            lat, lon, prem, sub, pc = (None, None, None, None, None)
            if v:
                prem = (v.get("prem") or "").strip() or None
                street = (v.get("street") or "").strip()
                if street:
                    prem = f"{prem}, {street}" if prem else street
                sub = suburb_case(v.get("sub")) or None
                pc = (v.get("pc") or "").strip() or None
                if v.get("lat") is not None:
                    lat, lon = round(v["lat"], 5), round(v["lon"], 5)
            Bb["d"].append(0)
            Bb["id"].append(f"qldnow-{bi}-{i2}")
            Bb["n"].append(nm)
            Bb["ty"].append(b["ty"])
            Bb["prem"].append(prem)
            Bb["sub"].append(sub)
            Bb["pc"].append(pc)
            Bb["lat"].append(lat)
            Bb["lon"].append(lon)
            Bb["v"].append(votes)
            Bb["inf"].append(b["informal"])
            Bb["tpp"].append(None)
            Bb["tcp"].append(b["tcp"])
            Bb["fl"].append(None)
            Bb["dec"].append(None)
            Bb["vdec"].append(None)
            Bb["prev"].append(prev)
        lapsed = [n for n in keep24 if n not in labs
                  and n not in set(VENUE_ALIASES.get(dist, {}).values())
                  and n not in ("Postal", "Absent", "Enrolment/Provisional", "Enrolment-Provisional")]
        out["byelections"][dist] = {
            "date": e["day"], "ecqEvent": e["stub"], "div": D, "booths": Bb,
            "formal": ev["formal"], "informal": ev["informal"], "turnout": ev["turnout"],
            "enrolment": ev["enrolled"],
            "lapsed2024": lapsed,
        }
        win_b = qld_ecq.bucket(win_ab)
        base_b = qld_ecq.bucket(next(c for c in bdiv["c"] if c[6] == 1)[1])
        seats[win_b] += 1
        seats[base_b] -= 1
        print(f"{dist}: {e['stub']} formal {ev['formal']} informal {ev['informal']} turnout {ev['turnout']} "
              f"| {len(labs)} booths | winner {winner} ({win_ab}) | lapsed 2024 booths {len(lapsed)}")

    got = dict(sorted(seats.items()))
    if got != EXPECTED_CHAMBER:
        fail(f"chamber after by-elections {got} != expected {EXPECTED_CHAMBER}")
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"chamber after by-elections: {got}")
    print(f"qld-now -> {OUT} ({os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
