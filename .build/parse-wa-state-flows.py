"""parse-wa-state-flows.py - build WA's per-election preference-flow table
from the WAEC EIS results-API mirror (.build/state-flow-src/wa/, committed).

Same estimand as .build/parse-vic-state-flows.py (and the AEC 1996-2001
classic cut in .build/aec-flow-history.py): for every district whose final
two were one Labor and one Liberal or Nationals WA candidate (CLASSIC
seats), walk the distribution-of-preferences chain with ballot piles
decomposed by party of first-preference origin and read off where each
bucket's ballots sat at the final count. Non-classic finals contribute
primaries but no flows. WA chains never truncate early (the EIS publishes
the full chain to the final pair), unlike some VEC cutoff pages.

Schema notes (verified against the live API 2026-10-20):
  * resultsCandidates: bare surname rows, {BALLOT_PAPER_NAME, PARTY_AFFILIATION,
    Ballot_Paper_Order, Votes_Counted} - candidate identity is
    (surname, party) via Ballot_Paper_Order (2001 Albany has WATSON-ALP and
    WATSON-IND in one district).
  * resultsFullDistribution: rows named "SURNAME - PARTY" in ballot order.
    FILE ORDER is authoritative (FP -> Distribution 1 -> Progressive
    Total 1 -> ...; DISTRIBUTION_LEVEL is a display string and
    PREFERENCE_LEVEL is flat 1 in every year, so never order on them).
    FORMAL_LAST_PUBLISHED_NUMBER_ENTERED is:
      First Preference / Progressive Total N -> the candidate's pile;
      Distribution N -> the DELTA moved (negative on the excluded
        candidate's own row, exactly -pile, and >= 0 on recipients -
        the row repeats for every candidate including one zero row per
        already-excluded candidate who had no receipts).
    EXHAUSTED_LAST_PUBLISHED_NUMBER_ENTERED is CUMULATIVE on every row and
    identical across the level; a Distribution level's recipient deltas
    plus the exhaustion increase equal the excluded pile.
    The final Progressive Total equals results2CP totals.
  * Nationals WA ("NAT"/"NATS") are their own bucket, Coalition in the
    classic final pair (ALP v NAT finals in 2021), same treatment as the
    VIC parser's AEC NP/CLP.

Appends to (never rewrites) data/state-flows.csv: rows for jurisdiction
"wa" replace only their own block, every other jurisdiction survives
untouched. Run order against parse-vic-state-flows.py does not matter.
"""
import csv
import glob
import json
import os
import sys

ROOT = os.path.join(".build", "state-flow-src", "wa")
YEARS = (2001, 2005, 2008, 2013, 2017, 2021, 2025)
OUT = "data/state-flows.csv"
COLS = ["jurisdiction", "year", "party", "prim_votes", "prim_share",
        "flow_alp_votes", "flow_coal_votes", "flow_to_alp",
        "n_seats", "n_dop", "n_classic", "formal_votes"]
BUCKETS = ("alp", "lib", "nat", "grn", "onp", "oth")
EMIT = ("grn", "onp", "oth", "lib", "nat", "alp")


def bucket_for(code):
    """WAEC PARTY_AFFILIATION code -> flow bucket (federal FLOW_LEF vocab)."""
    c = (code or "").upper().strip()
    if c == "ALP":
        return "alp"
    if c == "LIB":
        return "lib"
    if c in ("NAT", "NATS", "NP"):
        return "nat"
    if c in ("GRN", "GWA"):
        return "grn"
    if c in ("PHO", "ONP", "PHON", "ON"):
        return "onp"
    return "oth"


def parse_district(path):
    d = json.load(open(path))
    cands = d.get("resultsCandidates") or []
    fd = d.get("resultsFullDistribution") or []
    if not cands or not fd:
        return None
    # candidate identity by ballot order (surname collisions exist).
    # PARTY_AFFILIATION is "" for genuine independents in 2001-2013; the
    # chain names those rows "SUR" or "SUR - " depending on year, so build
    # the full key list per candidate and match chain rows by surname when
    # the direct key misses.
    fp_party = {}            # "SUR - PTY" -> bucket (PTY "" kept for IND)
    order = []               # full candidate names in ballot order
    by_surname = {}          # surname -> [(name, bucket)] in ballot order
    raw_names = {r.get("BALLOT_PAPER_NAME") for r in fd if r.get("DISTRIBUTION_LEVEL") == "First Preference"}
    for c in sorted(cands, key=lambda c: c.get("Ballot_Paper_Order", 0)):
        sur = str(c["BALLOT_PAPER_NAME"]).strip()
        pty = str(c.get("PARTY_AFFILIATION") or "").strip()
        want = f"{sur} - {pty}"
        raw_upper = {n.upper(): n for n in raw_names}
        if want in raw_names:
            full = want
        elif want.upper() in raw_upper:
            full = raw_upper[want.upper()]
        elif f"{sur} - " in raw_names and not pty:
            full = f"{sur} - "
        elif sur in raw_names and not pty:
            full = sur
        else:
            full = want
        order.append(full)
        fp_party[full] = bucket_for(pty or "IND")
        by_surname.setdefault(sur, []).append((full, fp_party[full]))
    # distribution rows: a name is "SUR - PTY" where PTY may itself contain
    # a hyphen in no year seen, but split on the LAST " - " for safety
    def party_of(dist_name):
        if dist_name in fp_party:
            return fp_party[dist_name]
        sur = dist_name.rsplit(" - ", 1)[0]
        hits = by_surname.get(sur, [])
        return hits[0][1] if len(hits) == 1 else None

    party = {}
    for n in order:
        b = party_of(n)
        if b is None:
            return None
        party[n] = b
    # resultsCandidates "PARTY_AFFILIATION" is "" (not "IND") for genuine
    # independents in the older years; the chain names them "SUR - ".
    # A district row's name key is the chain form for every candidate.
    def chain_name(sur, pty):
        for n in order:
            if n == f"{sur} - {pty}":
                return n
        return None

    levels = []
    by_level = {}
    canon = {n.upper(): n for n in order}
    for r in fd:
        lv = r.get("DISTRIBUTION_LEVEL", "")
        nm = r.get("BALLOT_PAPER_NAME")
        if lv not in by_level:
            by_level[lv] = {}
            levels.append(lv)
        if nm in party:
            by_level[lv][nm] = (r.get("FORMAL_LAST_PUBLISHED_NUMBER_ENTERED"),
                                r.get("EXHAUSTED_LAST_PUBLISHED_NUMBER_ENTERED"))
        elif str(nm).upper() in canon:
            key = canon[str(nm).upper()]
            by_level[lv][key] = (r.get("FORMAL_LAST_PUBLISHED_NUMBER_ENTERED"),
                                 r.get("EXHAUSTED_LAST_PUBLISHED_NUMBER_ENTERED"))
    if "First Preference" not in by_level:
        return None
    if any(by_level["First Preference"].get(n) is None for n in order):
        return None
    fpv = {n: (by_level["First Preference"].get(n) or (0, 0))[0] or 0
           for n in order}
    progs = [lv for lv in levels if lv.startswith("Progressive Total")]
    if not progs:
        return None
    return {"names": order, "party": party, "fpv": fpv,
            "levels": levels, "by_level": by_level,
            "results2CP": d.get("results2CP") or []}


def seat_flow(p):
    names, party, by = p["names"], p["party"], p["by_level"]
    piles = {nm: {party[nm]: float(p["fpv"].get(nm, 0.0))} for nm in names}
    exh_prev = 0.0
    for lv in p["levels"]:
        if not lv.startswith("Distribution"):
            continue
        cells = by[lv]
        excl = next((n for n in names if n in cells
                     and cells[n][0] is not None and cells[n][0] < 0), None)
        if excl is None or excl not in piles:
            return None
        pile = piles.pop(excl)
        base = sum(pile.values())
        exhs = [c[1] for c in cells.values() if c[1] is not None]
        exh = float(max(exhs)) if exhs else exh_prev
        moved = sum(float(cells[n][0]) for n in names
                    if n in cells and n != excl and cells[n][0] and cells[n][0] > 0)
        denom = (moved + max(0.0, exh - exh_prev)) or base
        exh_prev = exh
        if denom <= 0:
            continue
        for rec in names:
            if rec == excl or rec not in piles:
                continue
            v = (cells.get(rec) or (0, 0))[0] or 0
            if v <= 0:
                continue
            for b, amt in pile.items():
                piles[rec][b] = piles[rec].get(b, 0.0) + amt * float(v) / denom
    survivors = list(piles)
    if len(survivors) != 2:
        return {"classic": False, "pair": sorted(party[nm] for nm in survivors)}
    dest = {nm: party[nm] for nm in survivors}
    bs = {dest[nm] for nm in survivors}
    if bs not in ({"alp", "lib"}, {"alp", "nat"}):
        return {"classic": False, "pair": sorted(bs)}
    alp_cand = next(nm for nm in survivors if dest[nm] == "alp")
    coal_cand = next(nm for nm in survivors if nm != alp_cand)
    flows = {}
    for nm, key in ((alp_cand, "alp"), (coal_cand, "coal")):
        for b, amt in piles[nm].items():
            flows.setdefault(b, {})[key] = amt
    return {"classic": True, "flows": flows}


def chain_mismatch(p):
    """Walk the raw level deltas and compare the final pair's totals with the
    WAEC's own results2CP; a list of (name, walked, printed) misses."""
    tot = {n: float(p["fpv"][n] or 0) for n in p["names"]}
    for lv in p["levels"]:
        if not lv.startswith("Distribution"):
            continue
        cells = p["by_level"][lv]
        out = [n for n in p["names"] if n in cells and (cells[n][0] or 0) < 0]
        for n in p["names"]:
            if n in cells and n in tot and cells[n][0]:
                tot[n] += cells[n][0]
        for n in out:
            tot.pop(n, None)
    got = {n.upper(): v for n, v in tot.items()}
    cp = {str(r.get("Ballot_Paper_Name", "")).upper(): r.get("Votes_Counted") for r in p["results2CP"]}
    return [(n, round(got.get(n, -1)), v) for n, v in cp.items()
            if v is not None and abs(got.get(n, -1e9) - v) > 1]


def main():
    years = [int(a) for a in sys.argv[1:]] or list(YEARS)
    keep = []
    if os.path.exists(OUT):
        with open(OUT) as f:
            keep = [r for r in csv.DictReader(f)
                    if not (r.get("jurisdiction") == "wa" and int(r["year"]) in years)]
    all_rows = list(keep)
    failures = []
    for year in years:
        prim = {b: 0.0 for b in BUCKETS}
        flows = {b: {"alp": 0.0, "coal": 0.0} for b in BUCKETS}
        n_seat = n_dop = n_classic = 0
        nonclassic = []
        for path in sorted(glob.glob(os.path.join(ROOT, f"sg{year}", "*.json"))):
            seat = os.path.basename(path)[:-5]
            p = parse_district(path)
            if not p:
                print(f"  !! {year} {seat}: unparsed")
                continue
            n_seat += 1
            n_dop += 1
            for nm, b in p["party"].items():
                prim[b] += p["fpv"].get(nm, 0.0)
            miss = chain_mismatch(p)
            if miss:
                print(f"  !! {year} {seat}: chain walk misses results2CP {miss}")
                failures.append((year, seat, miss))
            fl = seat_flow(p)
            if not fl:
                print(f"  !! {year} {seat}: chain did not resolve to two final candidates")
                continue
            if not fl["classic"]:
                nonclassic.append((seat, "/".join(fl["pair"])))
                continue
            n_classic += 1
            for b, d in fl["flows"].items():
                flows[b]["alp"] += d.get("alp", 0.0)
                flows[b]["coal"] += d.get("coal", 0.0)
        formal = sum(prim.values())
        for b in EMIT:
            fa, fc = flows[b]["alp"], flows[b]["coal"]
            all_rows.append({
                "jurisdiction": "wa", "year": year, "party": b,
                "prim_votes": round(prim[b]),
                "prim_share": round(100 * prim[b] / formal, 4) if formal else "",
                "flow_alp_votes": round(fa), "flow_coal_votes": round(fc),
                "flow_to_alp": round(fa / (fa + fc), 6) if fa + fc else "",
                "n_seats": n_seat, "n_dop": n_dop, "n_classic": n_classic,
                "formal_votes": round(formal)})
        tot_a = sum(flows[b]["alp"] for b in BUCKETS)
        tot_c = sum(flows[b]["coal"] for b in BUCKETS)
        print(f"{year}: {n_seat} seats, {n_dop} DOP, {n_classic} classic, "
              f"non-classic {nonclassic}")
        for r in all_rows[-6:]:
            f2 = f"{100*float(r['flow_to_alp']):5.1f}%" if r["flow_to_alp"] != "" else "    - "
            print(f"    {r['party']:<4} prim {r['prim_share']:>6}%  flow->ALP {f2}")
        if tot_a + tot_c:
            print(f"    pooled classic ALP-vs-Coal: {100*tot_a/(tot_a+tot_c):.2f}% of "
                  f"{round(tot_a+tot_c):,} ballots")
    if failures:
        sys.exit(f"{len(failures)} chain(s) miss results2CP – {OUT} left as it was")
    all_rows.sort(key=lambda r: (r["jurisdiction"], int(r["year"]), EMIT.index(r["party"])))
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(all_rows)
    print(f"\nwrote {OUT} ({len(all_rows)} rows total)")


if __name__ == "__main__":
    main()
