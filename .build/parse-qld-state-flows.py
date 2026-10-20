"""parse-qld-state-flows.py - build Queensland's per-election preference-flow
table from the ECQ publicResults.xml archives
(.build/state-flow-src/qld/, committed).

Same estimand as parse-wa-state-flows.py and the VEC pilot: in every
district whose final two were one Australian Labor Party candidate and one
Liberal National Party candidate (CLASSIC seats - Queensland's Coalition
is merged into the single LNP column at these elections), walk the
``Official Distribution of Preferences Count`` chain with ballot piles
decomposed by party of first-preference origin and read off where each
bucket's ballots sat at the final count. Non-classic finals contribute
primaries but no flows.

2017 (parse_booth_2017): the ECQ's older results site, one gzipped booth
page per district (see harvest-qld-state-flows.py); every chain is checked
against its District Total row the same way.

Schema notes (verified against the committed mirror 2026-10-20):
  * each election's districts sit under an <election> element with
    eventType="State General" (the archives also bundle a council
    by-election, which is ignored by that predicate).
  * per district, ``<candidates><candidate ...>`` carries ballotOrderNumber
    + party/partyCode; candidates are keyed by ``ballotOrderNumber``,
    which never duplicates (a name match would be ambiguous - 2020
    Maiwar has two "BURKE"s).
  * the DOP chain lives inside the <countRound> whose preferences="YES"
    (round 4 at both elections held so far): one <preferenceDistribution
    distribution="N" excludedBallotOrder="k"> per exclusion, with recipient
    <candidatePreferences> rows (positive deltas only - the excluded
    candidate's own row is NOT a block, its pile is the element's
    <votesDistributed>), an <exhausted><count> element (the delta for
    this exclusion, not cumulative), and <votesRemainingInCount>.
    countRound[4].<twoCandidateVotes> is the official TCP of the final
    pair (used to verify the chain walk).
  * partyCode is a short code in 2020 (LNP, Australian Labor Party, The
    Greens, Pauline Hanson's One Nation, KAP, CLMP, IND, ...) and
    again in 2024 (One Nation shortened, Family First / Libertarians
    appear). Bucket mapping mirrors the federal FLOW_LEF vocabulary
    (grn, onp, oth, lib, nat, alp).

Appends to (never rewrites) data/state-flows.csv: rows for jurisdiction
"qld" replace only their own block.
"""
import csv
import gzip
import html
import os
import re
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.join(".build", "state-flow-src", "qld")
YEARS = (2004, 2006, 2009, 2012, 2015, 2017, 2020, 2024)
OLD_YEARS = (2004, 2006, 2009, 2012, 2015, 2017)     # the older results site
OUT = "data/state-flows.csv"
COLS = ["jurisdiction", "year", "party", "prim_votes", "prim_share",
        "flow_alp_votes", "flow_coal_votes", "flow_to_alp",
        "n_seats", "n_dop", "n_classic", "formal_votes"]
BUCKETS = ("alp", "lib", "nat", "grn", "onp", "oth")
EMIT = ("grn", "onp", "oth", "lib", "nat", "alp")


def bucket_for(code):
    """ECQ partyCode text -> flow bucket."""
    c = (code or "").upper().strip()
    if c in ("ALP", "AUSTRALIAN LABOR PARTY", "LABOR"):
        return "alp"
    if c in ("NPA",):                 # the Nationals, apart until the 2008 merger
        return "nat"
    if c in ("LNP", "LIB", "LIBERAL", "NAT", "NATS", "NP", "LIBNATS",
             "LIBERAL NATIONAL PARTY", "LIBERAL NATIONAL PARTY OF QUEENSLAND"):
        return "lib"
    if c in ("GRN", "GREENS", "THE GREENS", "QLD GREENS"):
        return "grn"
    if c in ("ONP", "PHON", "ON", "ONE NATION", "PAULINE HANSON'S ONE NATION",
             "PAULINE HANSON’S ONE NATION"):
        return "onp"
    return "oth"


def parse_election(year):
    path = os.path.join(ROOT, str(year), "xml", "publicResults.xml")
    root = ET.parse(path).getroot()
    for el in root.findall("election"):
        if el.get("eventType") == "State General":
            return el
    return None


def parse_district(d):
    cands_block = d.find("candidates")
    if cands_block is None:
        return None
    order, party = [], {}
    for c in cands_block.findall("candidate"):
        bo = c.get("ballotOrderNumber")
        if not bo:
            continue
        order.append(bo)
        party[bo] = bucket_for(c.get("partyCode") or c.get("party"))
    dop = None
    tcp = {}
    for cr in d.findall("countRound"):
        if cr.get("preferences") != "YES":
            continue
        pds = cr.find("preferenceDistributionSummary")
        chain = []
        if pds is not None:
            for pd in pds.findall("preferenceDistribution"):
                excl = pd.get("excludedBallotOrder")
                ex = pd.find("exhausted")
                exh = int(ex.findtext("count") or 0) if ex is not None else 0
                moved = {}
                for cp in pd.findall("candidatePreferences"):
                    moved[cp.get("ballotOrderNumber")] = \
                        int(cp.findtext("count") or 0)
                chain.append((excl, exh, moved))
        two = cr.find("twoCandidateVotes")
        if two is not None:
            for c in two.findall("candidate"):
                tcp[c.get("ballotOrderNumber")] = int(c.findtext("count") or 0)
        dop = chain
    # first preferences are taken from the DOP round's summary if present,
    # else from the Official First Preference round's primaryVoteResults
    fpv = {}
    for cr in d.findall("countRound"):
        if cr.get("preliminary") == "NO" and cr.get("preferences") == "NO":
            pv = cr.find("primaryVoteResults")
            if pv is not None:
                for c in pv.findall("candidate"):
                    fpv[c.get("ballotOrderNumber")] = \
                        int(c.findtext("count") or 0)
    if not fpv:
        pds = None
        for cr in d.findall("countRound"):
            if cr.get("preferences") == "YES":
                pds = cr.find("preferenceDistributionSummary")
                break
        if pds is not None:
            pv = pds.find("primaryVotes")
            if pv is not None:
                for c in pv.findall("candidate"):
                    fpv[c.get("ballotOrderNumber")] = \
                        int(c.findtext("count") or 0)
    if not order or not fpv or dop is None:
        return None
    return {"order": order, "party": party, "fpv": fpv,
            "chain": dop, "tcp": tcp}


def _cells(r):
    return [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", c))).strip()
            for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)]


def _num(x):
    x = (x or "").replace(",", "").strip()
    return float(x) if re.fullmatch(r"-?\d+(\.\d+)?", x) else None


def parse_district_summary(doc):
    """A district with nothing to distribute (two candidates): its summary
    page's Candidate | Party | Votes rows give the primaries."""
    m = re.search(r"\d{4} State General Election - (.*?)\s*-?\s*District Summary", doc)
    order, party, fpv = [], {}, {}
    for r in re.findall(r"<tr.*?</tr>", doc, re.S):
        c = _cells(r)
        if len(c) >= 3 and "," in c[0] and _num(c[2]) is not None and re.fullmatch(r"[A-Z0-9]{0,6}", c[1] or ""):
            order.append(c[0])
            party[c[0]] = bucket_for(c[1] or "IND")
            fpv[c[0]] = _num(c[2])
    if not order:
        return None
    return {"district": m.group(1) if m else "?", "order": order, "party": party,
            "fpv": fpv, "chain": [], "tcp": {}}


def parse_booth_2017(doc):
    """One 2017 booth page's "Summary of Distribution of Preferences" table
    -> parse_district's shape, candidates keyed by name. The header names
    each candidate "SURNAME, Given PARTY" (no code for an independent); each
    "X Excluded" row gives every continuing candidate's transfer and the
    exhausted count; the "Total" row after it is the running pile. The
    excluded candidate is whoever drops out of the next total (not the
    row's label, which names a surname only)."""
    i = doc.find("Votes Remaining in Count")
    if i < 0:
        return None
    m = re.search(r"\d{4} State General Election - (.*?)\s*-?\s*Booth Details", doc)
    rows = [_cells(r) for r in re.findall(r"<tr.*?</tr>", doc[doc.rfind("<table", 0, i):doc.find("</table>", i)], re.S)]
    head = next((r for r in rows if r and r[0] == "Preference Distribution"), None)
    if not head:
        return None
    order, party = [], {}
    for c in head[1:head.index("Votes Remaining in Count")]:
        mm = re.match(r"^(.*?)\s+([A-Z][A-Z0-9]{1,6})$", c)
        nm, code = (mm.group(1), mm.group(2)) if mm and "," in mm.group(1) else (c, "IND")
        order.append(nm)
        party[nm] = bucket_for(code)
    k = len(order)

    def vals(r):
        return {n: _num(r[1 + 2 * j]) for j, n in enumerate(order) if 1 + 2 * j < len(r)}, \
            _num(r[2 + 2 * k]) if len(r) > 2 + 2 * k else None
    fp = next((r for r in rows if r and r[0] == "First Preference Votes"), None)
    if not fp:
        return None
    fpv = {n: v or 0.0 for n, v in vals(fp)[0].items()}
    chain, prev, tcp = [], {n: v for n, v in fpv.items()}, {}
    pending = None
    for r in rows:
        if r and r[0].endswith("Excluded"):
            v, exh = vals(r)
            pending = ({n: x for n, x in v.items() if x}, exh or 0.0)
        elif r and r[0] in ("Total", "District Total") and pending:
            cur = {n: x for n, x in vals(r)[0].items() if x is not None}
            gone = [n for n in prev if n not in cur]
            if len(gone) != 1:
                return None
            chain.append((gone[0], pending[1], pending[0]))
            prev, pending = cur, None
            if r[0] == "District Total":
                tcp = cur
    return {"district": m.group(1) if m else "?", "order": order, "party": party,
            "fpv": fpv, "chain": chain, "tcp": tcp}


def districts_of(year):
    """[(district, parsed or None)] for one election, whichever its format."""
    if year in OLD_YEARS:
        d = os.path.join(ROOT, str(year))
        out, n = [], 1
        while os.path.exists(os.path.join(d, f"booth{n}.html.gz")):
            p = parse_booth_2017(gzip.open(os.path.join(d, f"booth{n}.html.gz")).read().decode("utf-8", "replace"))
            summ = os.path.join(d, f"district{n}.html.gz")
            if p is None and os.path.exists(summ):
                p = parse_district_summary(gzip.open(summ).read().decode("utf-8", "replace"))
            out.append((p["district"] if p else f"booth{n}", p))
            n += 1
        return out
    el = parse_election(year)
    if el is None:
        return []
    return [(d.get("districtName") or "?", parse_district(d)) for d in el.find("districts").findall("district")]


def seat_flow(p):
    bo_order, party = p["order"], p["party"]
    piles = {bo: {party[bo]: float(p["fpv"].get(bo, 0.0))} for bo in bo_order}
    for excl, exh, moved in p["chain"]:
        if excl not in piles:
            return None
        pile = piles.pop(excl)
        base = sum(pile.values())
        tot_moved = sum(moved.values())
        denom = (tot_moved + exh) or base
        if denom <= 0:
            continue
        for rec, v in moved.items():
            if rec == excl or rec not in piles or v <= 0:
                continue
            for b, amt in pile.items():
                piles[rec][b] = piles[rec].get(b, 0.0) + amt * v / denom
    survivors = list(piles)
    if len(survivors) != 2:
        return {"classic": False, "pair": sorted(party[x] for x in survivors)}
    bs = {party[x] for x in survivors}
    if bs not in ({"alp", "lib"}, {"alp", "nat"}):
        return {"classic": False, "pair": sorted(bs)}
    alp_cand = next(x for x in survivors if party[x] == "alp")
    coal_cand = next(x for x in survivors if x != alp_cand)
    flows = {}
    for bo, key in ((alp_cand, "alp"), (coal_cand, "coal")):
        for b, amt in piles[bo].items():
            flows.setdefault(b, {})[key] = amt
    return {"classic": True, "flows": flows}


def verify_seat(p):
    """Final progressive pile totals vs the official twoCandidateVotes."""
    bo_order, party = p["order"], p["party"]
    piles = {bo: float(p["fpv"].get(bo, 0.0)) for bo in bo_order}
    for excl, exh, moved in p["chain"]:
        if excl not in piles:
            return None
        piles.pop(excl)
        for rec, v in moved.items():
            if rec in piles:
                piles[rec] += v
    if len(piles) < 2:
        return None
    bad = []
    for bo, cnt in p["tcp"].items():
        if bo in piles and abs(piles[bo] - cnt) > 1:
            bad.append((bo, piles[bo], cnt))
    return bad


def main():
    years = [int(a) for a in sys.argv[1:]] or list(YEARS)
    keep = []
    if os.path.exists(OUT):
        with open(OUT) as f:
            keep = [r for r in csv.DictReader(f)
                    if not (r.get("jurisdiction") == "qld" and int(r["year"]) in years)]
    all_rows = list(keep)
    failures = []
    for year in years:
        districts = districts_of(year)
        if not districts:
            print(f"{year}: no State General election block, skipped")
            continue
        prim = {b: 0.0 for b in BUCKETS}
        flows = {b: {"alp": 0.0, "coal": 0.0} for b in BUCKETS}
        n_seat = n_dop = n_classic = 0
        nonclassic = []
        bad_verify = []
        for seat, p in districts:
            if not p:
                print(f"  !! {year} {seat}: unparsed")
                failures.append((year, seat, "unparsed"))
                continue
            n_seat += 1
            if not p["chain"]:
                continue
            n_dop += 1
            for bo, b in p["party"].items():
                prim[b] += p["fpv"].get(bo, 0.0)
            vf = verify_seat(p)
            if vf:
                bad_verify.append((seat, vf))
            fl = seat_flow(p)
            if not fl:
                print(f"  !! {year} {seat}: chain unresolved")
                continue
            if not fl["classic"]:
                nonclassic.append((seat, "/".join(fl["pair"])))
                continue
            n_classic += 1
            for b, dct in fl["flows"].items():
                flows[b]["alp"] += dct.get("alp", 0.0)
                flows[b]["coal"] += dct.get("coal", 0.0)
        formal = sum(prim.values())
        for b in EMIT:
            fa, fc = flows[b]["alp"], flows[b]["coal"]
            all_rows.append({
                "jurisdiction": "qld", "year": year, "party": b,
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
            print(f"   TCP-mismatch {bad_verify}")
            failures += [(year, seat, v) for seat, v in bad_verify]
        else:
            print("   all final piles matched the official TCP (±1)")
        for r in all_rows[-6:]:
            f2 = f"{100*float(r['flow_to_alp']):5.1f}%" if r["flow_to_alp"] != "" else "    - "
            print(f"    {r['party']:<4} prim {r['prim_share']:>6}%  flow->ALP {f2}")
        if tot_a + tot_c:
            print(f"    pooled classic ALP-vs-Coal: {100*tot_a/(tot_a+tot_c):.2f}% of "
                  f"{round(tot_a+tot_c):,} ballots")
    if failures:
        sys.exit(f"{len(failures)} chain(s) miss the official TCP – {OUT} left as it was")
    all_rows.sort(key=lambda r: (r["jurisdiction"], int(r["year"]),
                                 EMIT.index(r["party"])))
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(all_rows)
    print(f"\nwrote {OUT} ({len(all_rows)} rows total)")


if __name__ == "__main__":
    main()
