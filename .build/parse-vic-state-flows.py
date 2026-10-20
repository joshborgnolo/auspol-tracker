"""parse-vic-state-flows.py – build Victoria's per-election preference-flow
table from the VEC source mirror (.build/state-flow-src/vic/, committed).

For every state-election year on disk (2006, 2010, 2014, 2018, 2022) this
reads, per district:
  * the candidate table (name, party, first-preference votes) from the
    district RESULT page, and
  * the distribution-of-preferences chain table (first preferences, then one
    "Transfer of N ballot(-)papers of X" row per exclusion, FINAL TOTAL),
and emits data/state-flows.csv rows:
    jurisdiction,year,party,prim_votes,prim_share,
    flow_alp_votes,flow_coal_votes,flow_to_alp,
    n_seats,n_dop,n_classic
one row per (year, party bucket). Buckets mirror the federal FLOW_LEF
vocabulary – grn, onp, oth (every other non-major ballot, independents in) –
plus the majors (alp, lib, nat) so Coalition rows stay separable.

Estimand (mirrors the AEC 1996-2001 classic cut in .build/aec-flow-history.py):
  * PRIMARY SHARE – statewide formal first preferences by bucket, summed
    across districts.
  * FLOW – in districts whose final two were one ALP and one Coalition
    candidate (CLASSIC seats), each excluded candidate's pile is
    redistributed by the chain's transfer rows; piles are tracked decomposed
    by party of first-preference origin and each transfer spreads an origin's
    share of the pile across surviving recipients in proportion to the
    transfer row's split (the aggregate-table approximation of the AEC's
    ballot-level per-origin counts). The flow for a bucket is where its
    ballots sat at FINAL TOTAL: the share ending on the ALP candidate vs the
    Coalition one. Districts whose final pair was not ALP v Coalition
    (non-classic) contribute primaries but no flows, exactly as the federal
    classic cut does. A transfer row whose stated N disagrees with the
    running pile (rounding inside the authoritative count) is scaled off the
    row's stated N.
    That replay blends origins – a pile's inherited ballots take the pile's
    split – and scored against the AEC's counted flows it reads Greens 2-7
    points low; these flow_* columns are the first pass only. The figures
    the site draws are .build/estimate-state-flows.py's two-class estimates
    (data/state-flows-est.csv), which read the same chains through this
    file's readers.

Checks: every chain's walked pile totals must match the VEC's own FINAL
TOTAL (or last) row to the vote, or the parse stops – a misread column
can't write. Rows for other jurisdictions in data/state-flows.csv are kept;
only the "vic" block is replaced.

Coverage flags: 2010 has distribution pages for 44 of 88 districts only and
2018 for 48 of 88 (only seats whose count needed exclusions; majority seats
were never distributed). n_dop records what the flows are counted over.
2022 fills its 11 majority districts from the VEC's 2023 *indicative*
distribution set (xls downloads off the state-election-statistics page).

Sources per era:
  2006/2010: state{Y}result{d}.html (candidate table) +
             state{Y}distribution{d}.html (chain)
  2014/2018: {d}district.html (candidate table) + distribution{d}.html (chain)
  2022:      {s}-district-results.html (candidate table) +
             {s}-distribution.html | indicative/{s}---*.xls(x) (chain)
"""
import csv
import glob
import html
import json
import os
import re
import sys

ROOT = os.path.join(".build", "state-flow-src", "vic")
YEARS = (2006, 2010, 2014, 2018, 2022)


def bucket_for(party):
    """Party label text -> flow bucket; mirrors the federal FLOW_LEF split."""
    p = party.upper()
    if not p.strip():
        return "oth"                       # independent
    if "LABOUR DLP" in p or p.startswith("DLP") or "DEMOCRATIC LABOUR" in p:
        return "oth"
    if "LABOR" in p or p == "ALP":
        return "alp"
    if "GREENS" in p:
        return "grn"
    if "ONE NATION" in p:
        return "onp"
    if "NATIONALS" in p:
        return "nat"
    if p.startswith("LIBERAL") and "DEMOCRAT" not in p:
        return "lib"
    return "oth"


def clean(t):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", t or ""))).strip()


def norm_name(n):
    return re.sub(r"\s+", " ", str(n).upper()).strip().rstrip(".")


def num(t):
    t = str(t).replace(",", "").replace("\xa0", "").strip().rstrip("%")
    if not t:
        return None
    try:
        v = float(t)
    except ValueError:
        return None
    return int(v) if v == int(v) else v


# ---------------------------------------------------------------- HTML tables
def table_rows(path):
    """HTML doc -> list of tables, each a list of rows of cell texts."""
    h = open(path, encoding="utf-8", errors="replace").read()
    out = []
    for t in re.findall(r"<table.*?</table>", h, re.S):
        rows = []
        for r in re.findall(r"<tr.*?</tr>", t, re.S):
            cells = [clean(c) for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)]
            if any(cells):
                rows.append(cells)
        if rows:
            out.append(rows)
    return out


def parse_candidates(tables):
    """Find the Candidate/Party/1st-pref-votes table; return
    {norm_name: (bucket, fpv)}."""
    for rows in tables:
        head = [c.upper() for c in rows[0]]
        if not any("PARTY" in c for c in head) or not any("PREF" in c for c in head):
            continue
        out = {}
        for r in rows[1:]:
            if len(r) < 3 or re.search(r"total|informal", r[0], re.I):
                continue
            v = num(r[2])
            if v is not None:
                out[norm_name(r[0])] = (bucket_for(r[1]), v)
        return out or None
    return None


def _align(names, head=None):
    """Column-exact row reader: header cell positions name the candidate
    columns, so a row's values are read at those positions (right-padding
    short rows), never by counting numerics from the right."""
    if head is not None:
        cols = [i for i, c in enumerate(head) if c and c.upper() != "TOTAL"][: len(names)]

        def f(r):
            return {names[j]: (num(r[cols[j]]) if cols[j] < len(r) else None) or 0
                    for j in range(len(names))}
        return f

    def f(r):
        vals = [num(x) for x in r]
        nums = [v for v in vals if v is not None]
        nums = nums[: len(names)] if len(nums) > len(names) else nums
        if len(nums) < len(names):
            nums += [0.0] * (len(names) - len(nums))
        return dict(zip(names, nums))
    return f


def parse_chain_html(path):
    for tables in table_rows(path):
        rows = tables
        labels = [r[0].upper() if r else "" for r in rows]
        if not any("FIRST PREFERENCE" in l for l in labels):
            continue
        fi = next(i for i, l in enumerate(labels) if "FIRST PREFERENCE" in l)
        head = rows[fi - 1]
        names = [norm_name(c) for c in head if c and c.upper() != "TOTAL"]
        align = _align(names, head)
        transfers, final = [], None
        for r in rows[fi + 1:]:
            lab = r[0].upper() if r else ""
            m = re.match(r"TRANSFER OF [\d,]+ BALLOT.? ?PAPERS? OF (.*?)\s*\(\d+", lab, re.I)
            if m:
                transfers.append((norm_name(m.group(1)), align(r)))
            elif "FINAL TOTAL" in lab:
                final = align(r)
        if final is None:
            final = align(rows[-1])
        return names, align(rows[fi]), transfers, final
    return None


def parse_chain_xls(path):
    if path.endswith(".xlsx"):
        from openpyxl import load_workbook
        sh = load_workbook(path, read_only=True).worksheets[0]
        grid = [["" if v is None else v for v in row] for row in sh.iter_rows(values_only=True)]
    else:
        import xlrd
        sh = xlrd.open_workbook(path).sheet_by_index(0)
        grid = [[sh.cell_value(r, c) for c in range(sh.ncols)] for r in range(sh.nrows)]
    grid = [["" if v is None else (v if isinstance(v, (int, float)) else clean(str(v))) for v in row]
            for row in grid]
    hi = next((i for i, r in enumerate(grid)
               if r and isinstance(r[0], str) and "CANDIDATES NAMES" in r[0].upper()), None)
    if hi is None:
        return None
    cols = [i for i, c in enumerate(grid[hi])
            if isinstance(c, str) and c and c.upper() != "TOTAL"][1:]
    names = [norm_name(grid[hi][i]) for i in cols]

    # column-exact, as the HTML reader is: an excluded candidate's column
    # goes blank in every later row, and dropping blanks before pairing
    # values with names shifted each later transfer onto the wrong candidate
    def align(r):
        return {nm: ((num(r[i]) if i < len(r) else None) or 0)
                for nm, i in zip(names, cols)}

    fpv, transfers, final = None, [], None
    for r in grid[hi + 1:]:
        lab = str(r[0]).upper() if r and isinstance(r[0], str) and r[0] else ""
        if "FIRST PREFERENCE" in lab:
            fpv = align(r)
        elif "TRANSFER OF" in lab:
            m = re.match(r"TRANSFER OF [\d,.]+ BALLOT.? ?PAPERS? OF (.*?)\s*\(\d+", lab, re.I)
            if m:
                transfers.append((norm_name(m.group(1)), align(r)))
        elif "FINAL TOTAL" in lab:
            final = align(r)
    return names, fpv, transfers, final


# ----------------------------------------------------------------- eras
def docs_for(year, seat):
    """(candidate-table doc, chain doc or None) for a seat."""
    if year in (2006, 2010):
        cand = os.path.join(ROOT, str(year), f"state{year}result{seat}district.html")
        chain = os.path.join(ROOT, str(year), f"state{year}distribution{seat}district.html")
        return cand, chain if os.path.exists(chain) else None
    if year in (2014, 2018):
        cand = os.path.join(ROOT, str(year), f"{seat}district.html")
        chain = os.path.join(ROOT, str(year), f"distribution{seat}district.html")
        if not os.path.exists(chain):
            chain = os.path.join(ROOT, str(year), f"distribution{seat}.html")
        return cand, chain if os.path.exists(chain) else None
    if seat == "narracan":
        chain = os.path.join(ROOT, "2022", "indicative",
                             "narracan---indicative-distribution-of-preferences.xls")
        return os.path.join(ROOT, "2022", "narracan-district-supplementary.html"), \
            chain if os.path.exists(chain) else None
    base = os.path.join(ROOT, "2022")
    chain = os.path.join(base, f"{seat}-distribution.html")
    if not os.path.exists(chain):
        xi = glob.glob(os.path.join(base, "indicative", f"{seat}---*"))
        chain = xi[0] if xi else None
    return os.path.join(base, f"{seat}-district-results.html"), chain


def seats_of(year):
    if year in (2006, 2010):
        pre = f"state{year}result"
        return sorted(os.path.basename(p)[len(pre):][: -len("district.html")]
                      for p in glob.glob(os.path.join(ROOT, str(year), f"{pre}*district.html")))
    if year in (2014, 2018):
        return sorted(b[: -len("district.html")]
                      for b in map(os.path.basename, glob.glob(os.path.join(ROOT, str(year), "*district.html")))
                      if not re.match(r"^(distribution|fpvbyvotingcentre|tcpbyvotingcentre)", b))
    out = [os.path.basename(p)[: -len("-district-results.html")]
           for p in glob.glob(os.path.join(ROOT, "2022", "*-district-results.html"))]
    out.append("narracan")          # 2022 supplementary election
    return sorted(out)


def parse_seat(year, seat):
    """One district: {norm_name: (bucket, fpv)} from the result doc, and (if
    a chain doc exists) the DOP chain with parties aligned."""
    canddoc, chaindoc = docs_for(year, seat)
    if not os.path.exists(canddoc):
        return None
    cands = parse_candidates(table_rows(canddoc))
    if not cands:
        return None
    out = {"fpv": cands, "chain": None}
    if chaindoc:
        parsed = (parse_chain_xls(chaindoc) if chaindoc.endswith((".xls", ".xlsx"))
                  else parse_chain_html(chaindoc))
        if parsed:
            names, fpv, transfers, final = parsed
            if names and fpv:
                party = {}
                for nm in names:
                    if nm in cands:
                        party[nm] = cands[nm][0]
                        continue
                    sur = nm.split(",")[0]
                    hit = [k for k in cands if k.split(",")[0] == sur]
                    if len(hit) == 1:
                        party[nm] = cands[hit[0]][0]
                    else:
                        start = [k for k in cands if k.startswith(sur)]
                        party[nm] = cands[start[0]][0] if start else "oth"
                out["chain"] = {"names": names, "fpv": fpv, "party": party,
                                "transfers": transfers, "final": final}
    return out


def seat_flow(chain):
    """Walk one district's chain with origin-decomposed piles; return the
    per-origin flow into its final pair, or classic:False for a non-classic
    final pair."""
    names, party, fpv = chain["names"], chain["party"], chain["fpv"]
    piles = {nm: {party[nm]: float(fpv.get(nm, 0.0))} for nm in names}
    known = set(piles)
    for excl, adds in chain["transfers"]:
        if excl not in piles:
            # xls sources truncate long names in the transfer label
            # ("...NISA" for "...NISAR") – accept a unique prefix match
            hit = [k for k in known if k.startswith(excl) or excl.startswith(k)]
            excl = hit[0] if len(hit) == 1 else excl
        if excl not in piles:
            return None                        # transfer names a candidate we never saw
        pile = piles.pop(excl)
        n_row = sum(adds.values())
        base = sum(pile.values())
        denom = n_row or base
        if denom <= 0:
            continue
        for rec, v in adds.items():
            if rec not in piles or not v:
                continue
            for b, amt in pile.items():
                piles[rec][b] = piles[rec].get(b, 0.0) + amt * v / denom
    survivors = list(piles)
    if len(survivors) != 2:
        # chain stopped once the leader crossed 50% (final pair never
        # distributed) – true coverage outcome, not a parse failure
        return {"classic": False, "truncated": len(survivors) > 2,
                "pair": sorted(party[nm] for nm in survivors)}
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


def chain_mismatch(chain):
    """Walk the chain's raw transfers and compare each survivor's total with
    the VEC's own final row; a list of (name, walked, printed) misses."""
    tot = {nm: float(chain["fpv"].get(nm, 0.0)) for nm in chain["names"]}
    known = set(tot)
    for excl, adds in chain["transfers"]:
        if excl not in tot:
            hit = [k for k in known if k.startswith(excl) or excl.startswith(k)]
            excl = hit[0] if len(hit) == 1 else excl
        if excl not in tot:
            return [(excl, None, None)]
        tot.pop(excl)
        for rec, v in adds.items():
            if rec in tot and v:
                tot[rec] += v
    final = chain.get("final") or {}
    return [(nm, round(v), final[nm]) for nm, v in tot.items()
            if final.get(nm) and abs(v - final[nm]) > 1]


def main():
    years = [int(a) for a in sys.argv[1:]] or list(YEARS)
    buckets = ("alp", "lib", "nat", "grn", "onp", "oth")
    all_rows = []
    detail = {}
    bad = []
    for year in years:
        prim = {b: 0.0 for b in buckets}
        flows = {b: {"alp": 0.0, "coal": 0.0} for b in buckets}
        n_seat = n_dop = n_classic = 0
        nonclassic = []
        truncated = []
        for seat in seats_of(year):
            r = parse_seat(year, seat)
            if not r:
                print(f"  !! {year} {seat}: no candidate table")
                detail.setdefault(str(year), {})[seat] = {"cands": None}
                continue
            n_seat += 1
            for _nm, (b, v) in r["fpv"].items():
                prim[b] += v
            ch = r.get("chain")
            key = f"{year}:{seat}"
            if not ch:
                detail.setdefault(str(year), {})[seat] = {"dop": None}
                continue
            n_dop += 1
            miss = chain_mismatch(ch)
            if miss:
                bad.append((year, seat, miss))
            fl = seat_flow(ch)
            if not fl:
                print(f"  !! {year} {seat}: chain did not resolve to two final candidates")
                continue
            if not fl["classic"]:
                if fl.get("truncated"):
                    truncated.append(seat)
                else:
                    nonclassic.append((seat, fl["pair"]))
                continue
            n_classic += 1
            for b, d in fl["flows"].items():
                flows[b]["alp"] += d.get("alp", 0.0)
                flows[b]["coal"] += d.get("coal", 0.0)
            detail.setdefault(str(year), {})[seat] = {"dop": True}
        formal = sum(prim.values())
        for b in ("grn", "onp", "oth", "lib", "nat", "alp"):
            fa, fc = flows[b]["alp"], flows[b]["coal"]
            all_rows.append({
                "jurisdiction": "vic", "year": year, "party": b,
                "prim_votes": round(prim[b]),
                "prim_share": round(100 * prim[b] / formal, 4) if formal else "",
                "flow_alp_votes": round(fa), "flow_coal_votes": round(fc),
                "flow_to_alp": round(fa / (fa + fc), 6) if fa + fc else "",
                "n_seats": n_seat, "n_dop": n_dop, "n_classic": n_classic,
                "formal_votes": round(formal)})
        tot_a = sum(flows[b]["alp"] for b in buckets)
        tot_c = sum(flows[b]["coal"] for b in buckets)
        print(f"{year}: {n_seat} seats, {n_dop} DOP, {n_classic} classic, "
              f"{len(truncated)} truncated, non-classic {[s for s, _ in nonclassic]}")
        for r in all_rows[-6:]:
            fl = f"{100*r['flow_to_alp']:5.1f}%" if r["flow_to_alp"] != "" else "    – "
            print(f"    {r['party']:<4} prim {r['prim_share']:>6}%  flow→ALP {fl}")
        if tot_a + tot_c:
            print(f"    pooled classic ALP-vs-Coal: {100*tot_a/(tot_a+tot_c):.2f}% of "
                  f"{round(tot_a+tot_c):,} ballots")
    if bad:
        for year, seat, miss in bad:
            print(f"  !! {year} {seat}: chain walk misses the VEC's final row {miss}")
        sys.exit("chain check failed – data/state-flows.csv left as it was")
    os.makedirs("data", exist_ok=True)
    out = "data/state-flows.csv"
    cols = ["jurisdiction", "year", "party", "prim_votes", "prim_share",
            "flow_alp_votes", "flow_coal_votes", "flow_to_alp",
            "n_seats", "n_dop", "n_classic", "formal_votes"]
    emit = ("grn", "onp", "oth", "lib", "nat", "alp")
    # replace the vic years parsed now; every other row stays
    keep = []
    if os.path.exists(out):
        with open(out) as f:
            keep = [r for r in csv.DictReader(f)
                    if not (r.get("jurisdiction") == "vic" and int(r["year"]) in years)]
    rows = keep + all_rows
    rows.sort(key=lambda r: (r["jurisdiction"], int(r["year"]), emit.index(r["party"])))
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"\nwrote {out} ({len(all_rows)} vic rows, {len(rows)} in all)")
    os.makedirs(".matilda", exist_ok=True)
    with open(".matilda/vic-flow-detail.json", "w") as f:
        json.dump(detail, f)


if __name__ == "__main__":
    main()
