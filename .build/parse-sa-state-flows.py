"""parse-sa-state-flows.py - extend the per-election preference-flow table
to South Australia (2022 State Election; House of Assembly) from the
47 per-district "Final Distribution of Preferences" CSVs in
.build/state-flow-src/sa/2022/x/2022SE HA Final distribution csv/
(committed mirror; see harvest-sa-state-flows.py for harvesting and scope).

Same estimand as the QLD/WA/VIC parsers: in every district whose final
two surviving candidates were one Australian Labor Party candidate and
one Coalition candidate (LIB or NAT), walk the exclusion chain with
ballot piles decomposed by party of first-preference origin and read off
where each bucket's ballots sat at the final count. Non-classic finals
(Mount Gambier IND-held, plus any surprise pairings) contribute
primaries but no flows.

Schema notes (verified against the committed mirror 2026-10-20):
  * one CSV per district; header rows are banner-y lines
    ("Electoral Commission SA, ...", "Final Distribution ...",
    "Names of Candidates ...", "Absolute Majority (50% + 1) = ...")
  * a 5th block of cells begins: candidate names on the next row in
    columns 2..N-1, "TOTAL FORMAL VOTES" in the last cell (whose label
    is sometimes split by a literal newline); an "affiliations" row
    starts ",Votes transferred," followed by one affiliation token per
    candidate column. Affiliation vocab observed across the 47 CSVs:
    ALP, LIB, GRN, FFP, IND, ONP, AJP, NAT, AFP, RCH, SAB, LDP (plus
    one Excel-typed leading-space "LIB" variant).
  * "1st preference votes" row: per-candidate first preferences, with
    the formal total in the last cell.
  * k-th "excluded candidate SURNAME,<pile_at_exclusion>,<transfers...>"
    rows: a negative delta at the excluded candidate's own column and
    positive recipient deltas in the remaining columns; trailing
    exhaustion column is 0 (SA 2022 used compulsory preferential
    voting, no exhaust pile). Multiple candidates may be excluded in a
    single labelled row when the form guide declares a batch; in that
    case the row's leading quantity is the LAST exclusion's pile, and
    each excluded candidate's own column carries its own negative
    delta. The chain follows the negative cells, not the label.
  * "Progressive Total" rows separate each exclusion subtotal.
  * "FINAL DISTRICT TOTALS" row: the official final pair's pile
    totals; "FINAL %" row: their shares; "ELECTION RESULT" row:
    "ELECTED" cell beneath the elected candidate.

Appends to (never rewrites) data/state-flows.csv: rows for jurisdiction
"sa" replace only their own block.
"""
import csv
import os
import re
import sys

ROOT = os.path.join(".build", "state-flow-src", "sa", "2022", "x",
                    "2022SE HA Final distribution csv")
OUT = "data/state-flows.csv"
COLS = ["jurisdiction", "year", "party", "prim_votes", "prim_share",
        "flow_alp_votes", "flow_coal_votes", "flow_to_alp",
        "n_seats", "n_dop", "n_classic", "formal_votes"]
YEAR = 2022
BUCKETS = ("alp", "lib", "nat", "grn", "onp", "oth")
EMIT = ("grn", "onp", "oth", "lib", "nat", "alp")

COALITION = {"lib", "nat"}
LONG = {
    "AUSTRALIAN LABOR PARTY": "alp", "LABOR": "alp",
    "LIBERAL": "lib", "LIBERAL PARTY": "lib",
    "NATIONAL": "nat", "NATIONALS": "nat", "NATIONAL PARTY": "nat",
    "GREENS": "grn", "THE GREENS": "grn", "SA GREENS": "grn",
    "ONE NATION": "onp", "PAULINE HANSON'S ONE NATION": "onp",
    "PAULINE HANSON’S ONE NATION": "onp",
}


def bucket_for(tok):
    c = (tok or "").strip().upper()
    if c in ("ALP",):
        return "alp"
    if c in ("LIB", "LIBNATS", "LNP"):
        return "lib"
    if c in ("NAT", "NP"):
        return "nat"
    if c in ("GRN",):
        return "grn"
    if c in ("ONP", "PHON", "ON"):
        return "onp"
    if c in LONG:
        return LONG[c]
    return "oth"


def parse_num(s):
    t = (s or "").strip().strip('"')
    if t in ("", "Excluded", "ELECTED"):
        return None
    try:
        return int(t)
    except ValueError:
        try:
            return float(t)
        except ValueError:
            return None


def find_header_rows(rows):
    """Yield (r_affil, r_fpv) row indices for a district CSV. The
    candidate-name row sits immediately above the affiliation row (the
    one with "Votes transferred" in column 1); the Names-of-Candidates
    banner's relative position varies between districts, so it is not
    a reliable anchor."""
    r_affil = r_fpv = None
    for i, row in enumerate(rows):
        first = (row[0] or "").strip() if row else ""
        second = (row[1] or "").strip().lower() if len(row) > 1 else ""
        if second.startswith("votes transferred"):
            r_affil = i
            continue
        if re.match(r"^1st\s+preference", first, re.I) or \
                re.match(r"^1st\s+preference", second, re.I):
            r_fpv = i
            break
    r_name = r_affil - 1 if (r_affil is not None and r_affil >= 1) else None
    if r_name is not None:
        # sanity: candidate-name row must not itself be a banner row
        first = (rows[r_name][0] or "").strip().lower()
        if first.startswith(("names of", "absolute", "electoral", "final")):
            r_name = None
    return r_name, r_affil, r_fpv


def parse_district(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    r_name, r_affil, r_fpv = find_header_rows(rows)
    if r_name is None or r_affil is None or r_fpv is None:
        return None
    name_row = rows[r_name]
    affil_row = rows[r_affil]
    # detect candidate column span: names run in contiguous columns
    # starting at column 2; TOTAL FORMAL VOTES terminates the run.
    names = []
    cols = []
    for j in range(2, len(name_row)):
        cell = (name_row[j] or "").strip()
        if not cell:
            continue
        if cell.upper().startswith("TOTAL") or "FORMAL" in cell.upper():
            total_col = j
            break
        names.append(cell)
        cols.append(j)
    else:
        return None
    if len(names) < 2:
        return None
    # affiliations: same columns on the affiliation row
    affils = {}
    for j, name in zip(cols, names):
        aff = (affil_row[j] or "").strip() if j < len(affil_row) else ""
        affils[name] = bucket_for(aff)
    # first preferences
    fpv_row = rows[r_fpv]
    fpv = {}
    formal_total = None
    for j, name in zip(cols, names):
        v = parse_num(fpv_row[j] if j < len(fpv_row) else "")
        fpv[name] = float(v) if v is not None else 0.0
    if total_col is not None and total_col < len(fpv_row):
        formal_total = parse_num(fpv_row[total_col])
    # chain: "Nth excluded candidate SURNAME" rows -> per-candidate deltas
    chain = []
    final_row_i = None
    for i in range(r_fpv + 1, len(rows)):
        first = (rows[i][0] or "").strip()
        m = re.match(r"^(\d+)(?:st|nd|rd|th)\s+excluded\s+candidate", first, re.I)
        if m:
            delta = {}
            neg_cells = []
            for j, name in zip(cols, names):
                v = parse_num(rows[i][j] if j < len(rows[i]) else "")
                if v is None:
                    continue
                if v < 0:
                    neg_cells.append((name, -float(v)))
                elif v > 0:
                    delta[name] = float(v)
            chain.append({"order": int(m.group(1)), "label": first,
                          "neg": neg_cells, "pos": delta})
            continue
        if first.upper().startswith("FINAL DISTRICT"):
            final_row_i = i
            break
    final = {}
    if final_row_i is not None:
        row = rows[final_row_i]
        for j, name in zip(cols, names):
            cell = (row[j] or "").strip() if j < len(row) else ""
            if cell.lower() in ("excluded", ""):
                continue
            v = parse_num(cell)
            if v is not None:
                final[name] = float(v)
    return {"names": names, "affils": affils, "fpv": fpv,
            "chain": chain, "final": final,
            "formal": formal_total, "total_col": total_col}


def seat_flow(p):
    names, affils, fpv = p["names"], p["affils"], p["fpv"]
    # original bucket piles per candidate
    piles = {n: {affils[n]: float(fpv.get(n, 0.0))} for n in names}
    # walk the chain; excluded candidates are those carrying a negative cell
    for step in p["chain"]:
        negs = step["neg"]
        if not negs:
            return None
        # sum origin-piles of every excluded candidate on this row so a
        # batch exclusion redistributes their combined pile
        combined = {}
        for name, _amt in negs:
            if name not in piles:
                return None
            sub = piles.pop(name)
            for b, amt in sub.items():
                combined[b] = combined.get(b, 0.0) + amt
        moved = step["pos"]
        tot_moved = sum(moved.values())
        base = sum(combined.values())
        # exhaust at SA 2022 is the THIRD trailing-cell column; the
        # published CSVs leave it as 0 in the cells we read (we don't
        # track an exhaustion column because none is needed for CPV).
        denom = tot_moved or base
        if denom <= 0:
            continue
        for rec, v in moved.items():
            if rec not in piles or v <= 0:
                continue
            for b, amt in combined.items():
                piles[rec][b] = piles[rec].get(b, 0.0) + amt * v / denom
    survivors = list(piles)
    if len(survivors) != 2:
        return {"classic": False, "pair": sorted(affils[x] for x in survivors)}
    bs = {affils[x] for x in survivors}
    if not (("alp" in bs) and (bs & COALITION)):
        return {"classic": False, "pair": sorted(bs)}
    alp_c = next(x for x in survivors if affils[x] == "alp")
    coal_c = next(x for x in survivors if x != alp_c)
    flows = {}
    for src, key in ((alp_c, "alp"), (coal_c, "coal")):
        for b, amt in piles[src].items():
            flows.setdefault(b, {})[key] = amt
    return {"classic": True, "flows": flows}


def verify_seat(p):
    """Final pile sums vs the FINAL DISTRICT TOTALS row (±1)."""
    names, fpv = p["names"], p["fpv"]
    piles = {n: float(fpv.get(n, 0.0)) for n in names}
    for step in p["chain"]:
        for name, _amt in step["neg"]:
            if name not in piles:
                return None
            piles.pop(name)
        for rec, v in step["pos"].items():
            if rec in piles:
                piles[rec] += v
    bad = []
    for name, amt in p["final"].items():
        if name in piles and abs(piles[name] - amt) > 1:
            bad.append((name, piles[name], amt))
    return bad


def main():
    years = [YEAR]
    keep = []
    if os.path.exists(OUT):
        with open(OUT) as f:
            keep = [r for r in csv.DictReader(f)
                    if r.get("jurisdiction") != "sa"]
    all_rows = list(keep)
    for year in years:
        files = sorted(
            os.path.join(ROOT, n) for n in os.listdir(ROOT)
            if n.lower().endswith(".csv"))
        prim = {b: 0.0 for b in BUCKETS}
        flows = {b: {"alp": 0.0, "coal": 0.0} for b in BUCKETS}
        n_seat = n_dop = n_classic = 0
        nonclassic = []
        bad_verify = []
        for fpath in files:
            seat = os.path.basename(fpath)
            m = re.match(r"^2022SE\s+(.+?)\s*(?:final distribution|$)", seat)
            seat_short = m.group(1) if m else seat
            p = parse_district(fpath)
            if not p:
                print(f"  !! {year} {seat_short}: unparsed")
                continue
            n_seat += 1
            if not p["chain"]:
                continue
            n_dop += 1
            for n, b in p["affils"].items():
                prim[b] += p["fpv"].get(n, 0.0)
            vf = verify_seat(p)
            if vf:
                bad_verify.append((seat_short, vf))
            fl = seat_flow(p)
            if not fl:
                print(f"  !! {year} {seat_short}: chain unresolved")
                continue
            if not fl["classic"]:
                nonclassic.append((seat_short, "/".join(fl["pair"])))
                continue
            n_classic += 1
            for b, dct in fl["flows"].items():
                flows[b]["alp"] += dct.get("alp", 0.0)
                flows[b]["coal"] += dct.get("coal", 0.0)
        formal = sum(prim.values())
        for b in EMIT:
            fa, fc = flows[b]["alp"], flows[b]["coal"]
            all_rows.append({
                "jurisdiction": "sa", "year": year, "party": b,
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
        if bad_verify:
            print(f"   FINAL-TOTAL-mismatch {bad_verify}")
        else:
            print("   all final piles matched FINAL DISTRICT TOTALS (±1)")
        for r in all_rows[-6:]:
            f2 = f"{100*float(r['flow_to_alp']):5.1f}%" if r["flow_to_alp"] != "" else "    - "
            print(f"    {r['party']:<4} prim {r['prim_share']:>6}%  flow->ALP {f2}")
        if tot_a + tot_c:
            print(f"    pooled classic ALP-vs-Coal: {100*tot_a/(tot_a+tot_c):.2f}% of "
                  f"{round(tot_a+tot_c):,} ballots")
    all_rows.sort(key=lambda r: (r["jurisdiction"], int(r["year"]),
                                 EMIT.index(r["party"])))
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(all_rows)
    print(f"\nwrote {OUT} ({len(all_rows)} rows total)")


if __name__ == "__main__":
    main()
