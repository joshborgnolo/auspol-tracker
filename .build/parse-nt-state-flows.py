"""parse-nt-state-flows.py - extend the per-election preference-flow table
to the Northern Territory (2016, 2020, 2024 Legislative Assembly general
elections) from the 75 mirrored per-division pages in
.build/state-flow-src/nt/<YEAR>/<div>.html (see harvest-nt-state-flows.py).
NTEC serves the Distribution of Preferences inline on each division's
results page; each page carries a table identified by its header
signature (columns "Count | Comments | <candidates> | [Exhausted] |
Total | Quota").

Same classic-cut estimand as the QLD/SA/WA/VIC parsers. Bucket map:
CLP (Country Liberal Party) -> lib (the merged NT Coalition partner, so
lib never coexists with nat here); the nat bucket never sees NT.
Territory Alliance (TA, a 2020 splinter of ex-CLP independents) and
1 Territory (1TP, 2016) map to oth; Independents map to oth.
GRN (NT Greens) -> grn; ALP -> alp.

Schema / anno quirks:
  * Header candidate cells concatenate given-name and SURNAME without
    whitespace in 2020/2024 ("WayneWRIGHT(Ind)"); 2016 sometimes has a
    space. Party sits inside the final "(ABBR)" group.
  * The DOP table sits twice on 2024 pages (a hidden skeleton plus the
    rendered copy); only the populated duplicate carries the chain
    rows, so the parser picks the last matching table.
  * Each exclusion step is a NUMBERED row ("2 <Name> excluded") of
    signed per-candidate deltas: the excluded candidate's own cell is
    negative, recipient cells positive; 2016 also carries an
    "Exhausted" column (NT's optional-preferential era; totals do not
    always reconcile to within +-1 because of ballot-formality
    cleaning between rounds). 2020/2024 drop the Exhausted column.
  * An unnumbered row whose Comments cell begins "Progressive" carries
    running totals; the LAST such row is the official final totals and
    is the verification target.
  * Two-candidate divisions have a chain of zero exclusions (Mulka
    2016/2020 alternated as Yingiya Guyula IND's Nhulunbuy, then the
    remapped Mulka seat; Mulka 2020 is IND v ALP with only two
    candidates; several 2024 bush seats are CLP v ALP with two
    candidates) and are non-classic. Blain 2016 (Mills IND vs Hale
    ALP) and Blain 2020 (Mills TA vs Turner ALP) are also non-classic
    finals.
  * Mulka 2020's page omits the DOP table entirely (no
    distribution-of-preferences section - a 2-candidate race settled
    at first preferences). The parser treats its primaries as
    contribution rows.
  * 2024 Mulka's page is missing from the current-elections tree (404
    shell); harvest pulls it from the past-elections tree instead.

Appends rows for jurisdiction "nt" to data/state-flows.csv, replacing
only that jurisdiction's block.
"""
import csv
import html as _html
import os
import re
import sys

ROOT = ".build/state-flow-src/nt"
OUT = "data/state-flows.csv"
COLS = ["jurisdiction", "year", "party", "prim_votes", "prim_share",
        "flow_alp_votes", "flow_coal_votes", "flow_to_alp",
        "n_seats", "n_dop", "n_classic", "formal_votes"]
YEARS = (2016, 2020, 2024)
BUCKETS = ("alp", "lib", "nat", "grn", "onp", "oth")
EMIT = ("grn", "onp", "oth", "lib", "nat", "alp")
COALITION = {"lib", "nat"}

# DOP table is the one whose first body row opens "First preferences"
# (it appears as a hidden skeleton + a rendered copy on 2024 pages).
DOP_TABLE_RE = re.compile(
    r"<table[^>]*>(?:(?!</table>).)*?First preferences.*?</table>", re.S)
# Electorate-summary table (every division page has one; the only
# candidate/primary source on pages with no DOP table, e.g. 2-candidate
# 2020 Mulka).
SUMMARY_TABLE_RE = re.compile(
    r"<table[^>]*>(?:(?!</table>).)*?Candidate.*?Party.*?</table>", re.S)
ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S)
CELL_RE = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.S)
STRIP_RE = re.compile(r"<[^>]+>")
HEADER_CAND_RE = re.compile(r"^(.*?)\s*\(([A-Za-z0-9]+)\)\s*$")


def strip_tags(s):
    return _html.unescape(STRIP_RE.sub("", s)).strip()


def parse_num(s):
    t = (s or "").strip().strip('"').replace(",", "")
    if t in ("", "Excluded", "ELECTED", "-"):
        return None
    try:
        return float(t)
    except ValueError:
        return None


def bucket_for(party):
    c = (party or "").strip().upper()
    if c in ("ALP",):
        return "alp"
    if c in ("CLP",):
        # Country Liberal Party - NT's merged Coalition partner.
        return "lib"
    if c in ("GRN", "GREENS"):
        return "grn"
    if c in ("ON", "ONP", "PHON"):
        return "onp"
    # 1TP (1 Territory), TA (Territory Alliance), Ind, Immigration etc.
    return "oth"


def find_dop_tables(doc):
    """Yield every DOP-shaped table (header-signature matched). 2024
    pages contain a skeleton + the rendered copy; only the last has
    body rows."""
    for m in DOP_TABLE_RE.finditer(doc):
        yield m.group(0)


def parse_summary_table(doc):
    """Primaries from the electorate-summary table on a page with no
    DOP table (2-candidate race settled at first preferences).
    Returns {"cands", "parties", "fpv", "chain": [], "final": {}}
    or None."""
    m = SUMMARY_TABLE_RE.search(doc)
    if not m:
        return None
    rows = []
    for r in ROW_RE.finditer(m.group(0)):
        cells = [strip_tags(c) for c in CELL_RE.findall(r.group(1))]
        if cells:
            rows.append(cells)
    if not rows:
        return None
    header = [h.lower() for h in rows[0]]
    if len(header) >= 2 and "candidate" in header[0] and \
            "party" in header[1]:
        pass
    else:
        return None
    cands, parties, fpv = [], [], {}
    for cells in rows[1:]:
        if len(cells) < 3:
            # Formal/Informal/Total/Enrolment tail row
            break
        name, party, prim = cells[0].strip(), cells[1].strip(), \
            parse_num(cells[2])
        if prim is None:
            break
        cands.append(name)
        parties.append(party.upper())
        fpv[name] = prim
    if not cands:
        return None
    return {"cands": cands, "parties": dict(zip(cands, parties)),
            "fpv": fpv, "chain": [], "final": {}}


def parse_dop_table(body):
    """Return dict {cands: [(name, party)], rows: [cells...], exhaust_idx,
    total_idx, quota_idx} or None."""
    rows = []
    for r in ROW_RE.finditer(body):
        cells = [strip_tags(c) for c in CELL_RE.findall(r.group(1))]
        if cells:
            rows.append(cells)
    if not rows:
        return None
    header = rows[0]
    if len(header) < 4 or header[0].lower() != "count":
        return None
    # column layout: 0=Count, 1=Comments, 2..N-3=candidates, trailing
    # slots Exhausted/Total/Quota (Exhausted only 2016).
    tail = header[-3:]
    has_exhaust = any(t.strip().lower() == "exhausted" for t in header)
    if has_exhaust:
        if len(header) < 5:
            return None
        cand_cols = list(range(2, len(header) - 3))
        exhaust_col = len(header) - 3
        total_col = len(header) - 2
        quota_col = len(header) - 1
    else:
        cand_cols = list(range(2, len(header) - 2))
        exhaust_col = None
        total_col = len(header) - 2
        quota_col = len(header) - 1
    cands = []
    parties = []
    for j in cand_cols:
        cell = header[j]
        m = HEADER_CAND_RE.match(cell)
        if not m:
            return None
        name = re.sub(r"\s+", " ", m.group(1).strip())
        # Header concatenates given name to SURNAME ("WayneWRIGHT").
        # Split on the ALL-CAPS run for a cleaner lookup key.
        name = re.sub(r"([a-z])(?=[A-Z]{3,})", r"\1 ", name, count=1)
        cands.append(name)
        parties.append(m.group(2).upper())
    return {"header": header, "cands": cands, "parties": parties,
            "rows": rows[1:], "cand_cols": cand_cols,
            "exhaust_col": exhaust_col, "total_col": total_col}


def parse_division(path):
    with open(path, encoding="utf-8") as f:
        doc = f.read()
    tables = [t for t in find_dop_tables(doc) if ROW_RE.search(t)]
    if not tables:
        # No DOP table at all (e.g. 2-candidate 2020 Mulka) - fall back
        # to the electorate-summary table so the seat still contributes
        # its primaries.
        return parse_summary_table(doc)
    body = tables[-1]  # populated copy
    t = parse_dop_table(body)
    if t is None:
        return None
    cands = t["cands"]
    parties = t["parties"]
    cc = t["cand_cols"]
    ec = t["exhaust_col"]
    fpv = {c: 0.0 for c in cands}
    chain = []
    final = {}
    for cells in t["rows"]:
        # First-preferences row: first cell "1"
        if cells[0].strip() == "1" and \
                cells[1].strip().lower().startswith("first preferences"):
            for j, c in zip(cc, cands):
                if j < len(cells):
                    v = parse_num(cells[j])
                    if v is not None:
                        fpv[c] = v
            continue
        # Progressive row -> running totals (last one = official final)
        if cells[1].strip().lower().startswith("progressive"):
            cur = {}
            for j, c in zip(cc, cands):
                if j < len(cells):
                    v = parse_num(cells[j])
                    if v is not None:
                        cur[c] = v
            if cur:
                final = cur
            continue
        # Exclusion row: numbered first cell
        m = re.match(r"^\s*(\d+)\s*$", cells[0])
        if m and "excluded" in cells[1].lower():
            neg = []
            pos = {}
            exh = 0.0
            for j, c in zip(cc, cands):
                if j >= len(cells):
                    continue
                v = parse_num(cells[j])
                if v is None:
                    continue
                if v < 0:
                    neg.append((c, -v))
                elif v > 0:
                    pos[c] = v
            if ec is not None and ec < len(cells):
                ev = parse_num(cells[ec])
                if ev is not None:
                    exh = ev
            chain.append({"order": int(m.group(1)), "neg": neg,
                          "pos": pos, "exhaust": exh})
            continue
        # Batch-exclusion edge case: a numbered row with a slash list
        # (not observed in NT 2016-2024, but defensively match any 2+
        # exclusion count row without an "excluded" marker).
    if not any(fpv.values()):
        return None
    return {"cands": cands, "parties": dict(zip(cands, parties)),
            "fpv": fpv, "chain": chain, "final": final}


def seat_flow(parsed):
    cands = parsed["cands"]
    parties = parsed["parties"]
    chain = parsed["chain"]
    # Bucket per candidate
    buckets = {c: bucket_for(parties[c]) for c in cands}
    # Origin-decomposed piles per candidate
    piles = {c: {buckets[c]: parsed["fpv"].get(c, 0.0)} for c in cands}
    for step in chain:
        combined = {}
        for name, _ in step["neg"]:
            if name not in piles:
                return None
            sub = piles.pop(name)
            for b, amt in sub.items():
                combined[b] = combined.get(b, 0.0) + amt
        tot_moved = sum(step["pos"].values())
        if tot_moved <= 0:
            # pure-exhaust step (not expected in NT 2016-2024)
            continue
        denom = tot_moved
        for rec, v in step["pos"].items():
            if rec not in piles or v <= 0:
                continue
            for b, amt in combined.items():
                piles[rec][b] = piles[rec].get(b, 0.0) + amt * v / denom
    survivors = list(piles)
    if len(survivors) != 2:
        return {"classic": False,
                "pair": sorted(buckets[c] for c in survivors)}
    bs = {buckets[c] for c in survivors}
    if not (("alp" in bs) and (bs & COALITION)):
        return {"classic": False, "pair": sorted(bs)}
    alp_c = next(c for c in survivors if buckets[c] == "alp")
    coal_c = next(c for c in survivors if c != alp_c)
    flows = {}
    for src, key in ((alp_c, "alp"), (coal_c, "coal")):
        for b, amt in piles[src].items():
            flows.setdefault(b, {})[key] = amt
    return {"classic": True, "flows": flows}


def verify(parsed, tol=1.0):
    """Final pile sums vs the last Progressive row."""
    cands = parsed["cands"]
    piles = {c: parsed["fpv"].get(c, 0.0) for c in cands}
    for step in parsed["chain"]:
        for name, amt in step["neg"]:
            if name in piles:
                piles[name] -= amt
        for rec, v in step["pos"].items():
            if rec in piles:
                piles[rec] += v
    bad = []
    for c, amt in parsed["final"].items():
        if c in piles and abs(piles[c] - amt) > tol:
            bad.append((c, piles[c], amt))
    return bad


def main():
    keep = []
    if os.path.exists(OUT):
        with open(OUT) as f:
            keep = [r for r in csv.DictReader(f)
                    if r.get("jurisdiction") != "nt"]
    all_rows = list(keep)
    failures = []
    for year in YEARS:
        ydir = os.path.join(ROOT, str(year))
        files = sorted(
            (os.path.join(ydir, n) for n in os.listdir(ydir)
             if n.endswith(".html")))
        prim = {b: 0.0 for b in BUCKETS}
        flows = {b: {"alp": 0.0, "coal": 0.0} for b in BUCKETS}
        n_seat = n_dop = n_classic = 0
        nonclassic = []
        bad_verify = []
        for p in files:
            div = os.path.basename(p)[:-5]
            parsed = parse_division(p)
            if not parsed:
                print(f"  !! {year} {div}: unparsed")
                continue
            n_seat += 1
            if parsed["chain"]:
                n_dop += 1
            for c, b in ((c, bucket_for(parsed["parties"][c]))
                         for c in parsed["cands"]):
                prim[b] += parsed["fpv"].get(c, 0.0)
            bad = verify(parsed)
            if bad:
                bad_verify.append((div, bad))
            fl = seat_flow(parsed)
            if not fl:
                print(f"  !! {year} {div}: chain unresolved")
                continue
            if not fl["classic"]:
                nonclassic.append((div, "/".join(fl["pair"])))
                continue
            n_classic += 1
            for b, dct in fl["flows"].items():
                flows[b]["alp"] += dct.get("alp", 0.0)
                flows[b]["coal"] += dct.get("coal", 0.0)
        formal = sum(prim.values())
        for b in EMIT:
            fa, fc = flows[b]["alp"], flows[b]["coal"]
            all_rows.append({
                "jurisdiction": "nt", "year": year, "party": b,
                "prim_votes": round(prim[b]),
                "prim_share": round(100 * prim[b] / formal, 4)
                             if formal else "",
                "flow_alp_votes": round(fa), "flow_coal_votes": round(fc),
                "flow_to_alp": round(fa / (fa + fc), 6) if fa + fc else "",
                "n_seats": n_seat, "n_dop": n_dop, "n_classic": n_classic,
                "formal_votes": round(formal)})
        tot_a = sum(flows[b]["alp"] for b in BUCKETS)
        tot_c = sum(flows[b]["coal"] for b in BUCKETS)
        print(f"{year}: {n_seat} seats, {n_dop} DOP, {n_classic} classic, "
              f"non-classic {nonclassic}")
        if bad_verify:
            print(f"   PROGRESSIVE-final-mismatch {bad_verify}")
            failures += [(year, div, v) for div, v in bad_verify]
        else:
            print("   all final piles matched Progressive row (±1)")
        for r in all_rows[-6:]:
            f2 = (f"{100*float(r['flow_to_alp']):5.1f}%"
                  if r["flow_to_alp"] != "" else "    - ")
            print(f"    {r['party']:<4} prim {r['prim_share']:>6}%  "
                  f"flow->ALP {f2}")
        if tot_a + tot_c:
            print(f"    pooled classic ALP-vs-Coal: "
                  f"{100*tot_a/(tot_a+tot_c):.2f}% of "
                  f"{round(tot_a+tot_c):,} ballots")
    if failures:
        sys.exit(f"{len(failures)} chain(s) miss the Progressive row – {OUT} left as it was")
    all_rows.sort(key=lambda r: (r["jurisdiction"], int(r["year"]),
                                 EMIT.index(r["party"])))
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(all_rows)
    print(f"\nwrote {OUT} ({len(all_rows)} rows total)")


if __name__ == "__main__":
    sys.exit(main())
