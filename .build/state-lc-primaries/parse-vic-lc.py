#!/usr/bin/env python3
"""Victorian Legislative Council first-preference counts, 2006-2022.

Sources (all official VEC, mirrored in .build/state-flow-src/vic/lc/<year>/;
see README.md in this folder for the URLs):
  2006/2010: "Final first preference votes" tables on the
             state<year>result<region>region.html result pages
  2014/2018: the same tables on the <region>region.html pages
  2022:      "Region Votes Received (Details)" workbooks — the REGION TOTAL
             row's per-Group TOTAL columns (party = the header's middle line)

Of each region page/workbook the parser takes every candidate row's printed
1st-preference votes, sums them per party per region, then across the eight
regions per election. Guards: per region, the candidate sum must EQUAL the
printed Formal Votes figure (2006-2018), and every printed per-row vote
percentage must match votes/formal to its rounding (2022 has no printed
formal — the REGION TOTAL column sum is the formal count).

Output: vic.json — {"events": {year: {formal, byParty: {PARTY: votes},
byPartyCase, byFamily: ALP/COAL/GRN/ONP/OTHER}}}.

Run from the repo root:  python3 .build/state-lc-primaries/parse-vic-lc.py
(stdlib + xlrd; writes vic.json beside itself)
"""
import glob
import json
import os
import re
import sys

import xlrd

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, "..", "state-flow-src", "vic", "lc"))
OUT = os.path.join(HERE, "vic.json")

# Family mapping: exact (case-insensitive) party names to family.
FAMS = {
    "ALP": "ALP", "AUSTRALIAN LABOR PARTY": "ALP",
    "AUSTRALIAN LABOR PARTY - VICTORIAN BRANCH": "ALP",
    "LIBERAL": "COAL", "LIBERAL PARTY": "COAL",
    "THE NATIONALS": "COAL", "NATIONALS": "COAL", "THE NATIONAL PARTY": "COAL",
    "NATIONALS VICTORIA": "COAL",
    "LIBERAL / THE NATIONALS": "COAL",
    "GREENS": "GRN", "AUSTRALIAN GREENS": "GRN", "THE GREENS": "GRN",
    "ONE NATION": "ONP", "PAULINE HANSON'S ONE NATION": "ONP",
    "ONE NATION VICTORIA": "ONP",
}

REGIONS_06_10 = [
    "easternmetropolitan", "easternvictoria", "northernmetropolitan",
    "northernvictoria", "southeasternmetropolitan", "southernmetropolitan",
    "westernmetropolitan", "westernvictoria",
]
REGIONS_14_18 = [
    "easternmetropolitan", "easternvictoria", "northernmetropolitan",
    "northernvictoria", "south-easternmetropolitan", "southernmetropolitan",
    "westernmetropolitan", "westernvictoria",
]
REGIONS_22 = [
    "Eastern Victoria", "North-Eastern Metropolitan", "Northern Metropolitan",
    "Northern Victoria", "South-Eastern Metropolitan", "Southern Metropolitan",
    "Western Metropolitan", "Western Victoria",
]

CELL_RE = re.compile(r"<(td|th)[^>]*>(.*?)</\1>", re.S | re.I)


def cells(row_html):
    return [re.sub(r"<[^>]+>", "", c).strip() for _, c in CELL_RE.findall(row_html)]


def parse_html(path):
    """One region page -> (formal, {party: votes}); guards inside."""
    raw = open(path, encoding="utf-8", errors="replace").read()
    tables = re.findall(r"<table[^>]*summary=\"([^\"]*)\"[^>]*>(.*?)</table>", raw, re.S | re.I)
    formal = None
    votes = {}
    for summary, body in tables:
        if "Electorate results summary" in summary:
            for row in re.findall(r"<tr[^>]*>(.*?)</tr>", body, re.S | re.I):
                c = cells(row)
                if len(c) == 2 and c[0].replace("\xa0", " ").strip() == "Formal Votes:":
                    formal = int(c[1].split()[0].replace(",", ""))
        elif "First preference votes" in summary:
            for row in re.findall(r"<tr[^>]*>(.*?)</tr>", body, re.S | re.I):
                c = cells(row)
                if len(c) >= 4 and c[0] and c[0] != "Candidate":
                    try:
                        v = int(c[2].replace(",", ""))
                    except ValueError:
                        continue
                    m = re.search(r"([\d.]+)%", c[3])
                    votes.setdefault(c[1] or "Ungrouped", []).append((c[0], v,
                                                                        float(m.group(1)) if m else None))
    if formal is None:
        raise SystemExit(f"{path}: no Formal Votes figure")
    if not votes:
        raise SystemExit(f"{path}: no candidate rows")
    total = sum(v for rows in votes.values() for _, v, _ in rows)
    if total != formal:
        raise SystemExit(f"{path}: candidate votes {total} != formal {formal}")
    for party, rows in votes.items():
        for name, v, pct in rows:
            if pct is not None and abs(v / formal * 100 - pct) > 0.01 + 1e-9:
                raise SystemExit(f"{path}: {name} printed {pct}% but computes "
                                 f"{v / formal * 100:.4f}%")
    return formal, {p: sum(v for _, v, _ in rows) for p, rows in votes.items()}


def parse_xls(path):
    """2022 region workbook -> (formal, {party: votes}) via REGION TOTAL."""
    wb = xlrd.open_workbook(path)
    sh = wb.sheet_by_index(0)
    rt_row = None
    hdr = None
    for r in range(sh.nrows - 1, -1, -1):
        if str(sh.cell_value(r, 0)).strip() == "REGION TOTAL":
            rt_row = [sh.cell_value(r, c) or 0 for c in range(sh.ncols)]
            break
    if rt_row is None:
        raise SystemExit(f"{path}: no REGION TOTAL row")
    # the group headers' TOTAL columns read just "Group X\nTOTAL"; the
    # party comes from that group's "Group X\n<party>\nATL" cell
    for hr in range(0, sh.nrows):
        hdr_row = [str(sh.cell_value(hr, c)) for c in range(sh.ncols)]
        if any(h.startswith("Group ") and h.endswith("\nTOTAL") for h in hdr_row):
            hdr = hdr_row
            break
    if hdr is None:
        raise SystemExit(f"{path}: no group header")
    group_party = {}
    for h in hdr:
        parts = h.split("\n")
        if len(parts) == 3 and parts[0].startswith("Group ") and parts[2] != "TOTAL":
            group_party[parts[0]] = parts[1]
    votes = {}
    formal = None
    for c, h in enumerate(hdr):
        if h.startswith("Group ") and h.endswith("\nTOTAL"):
            # a party-less ticket names no party in its ATL cell either –
            # file it as such (it folds to OTHER regardless)
            party = group_party.get(h.split("\n")[0]) or \
                h.split("\n")[0] + " (no party)"
            v = int(round(rt_row[c]))
            votes[party] = votes.get(party, 0) + v
        elif h.startswith("Ungrouped\n"):
            votes["Ungrouped"] = votes.get("Ungrouped", 0) + int(round(rt_row[c]))
        elif h == "Total Formal":
            formal = int(round(rt_row[c]))
    if formal is None:
        raise SystemExit(f"{path}: no Total Formal column")
    if sum(votes.values()) != formal:
        raise SystemExit(f"{path}: group+ungrouped {sum(votes.values())} != "
                         f"Total Formal {formal}")
    if "Ungrouped" not in votes:
        votes.pop("Ungrouped", None)
    return formal, votes


def html_year_events(year, prefix, regions):
    formal_by_region, votes = 0, {}
    for reg in regions:
        path = os.path.join(SRC, str(year), f"{prefix}{reg}region.html")
        formal, pv = parse_html(path)
        formal_by_region += formal
        for p, v in pv.items():
            votes[p] = votes.get(p, 0) + v
    return formal_by_region, votes


def main():
    events = {}
    for year, prefix, regions in [
        (2006, "state2006result", REGIONS_06_10),
        (2010, "state2010result", REGIONS_06_10),
        (2014, "", REGIONS_14_18),
        (2018, "", REGIONS_14_18),
    ]:
        formal, votes = html_year_events(year, prefix, regions)
        events[str(year)] = {"formal": formal, "byParty": votes}
        print(f"{year}: formal {formal:,}, {len(votes)} parties/groups")
    formal, votes = 0, {}
    for reg in REGIONS_22:
        path = os.path.join(SRC, "2022", f"{reg} Region-Votes Received.xls")
        rf, pv = parse_xls(path)
        formal += rf
        for p, v in pv.items():
            votes[p] = votes.get(p, 0) + v
    events["2022"] = {"formal": formal, "byParty": votes}
    print(f"2022: formal {formal:,}, {len(votes)} parties/groups")

    for year, e in events.items():
        by_family = {}
        for party, v in e["byParty"].items():
            fam = FAMS.get(re.sub(r"\s+", " ", party).upper(), "OTHER")
            if fam == "OTHER" and v / e["formal"] * 100 >= 4 and party != "Ungrouped":
                print(f"   NOTE {year}: {party} ({v} votes, "
                      f"{v / e['formal'] * 100:.1f}%) is unmapped -> OTHER")
            by_family[fam] = by_family.get(fam, 0) + v
        for k in ("ALP", "COAL", "GRN", "ONP", "OTHER"):
            by_family.setdefault(k, 0)
        if sum(by_family.values()) != e["formal"]:
            raise SystemExit(f"{year}: family sum mismatch")
        e["byFamily"] = by_family
        for p, v in sorted(e["byParty"].items(), key=lambda kv: -kv[1])[:6]:
            print(f"   {year} {v / e['formal'] * 100:6.2f}%  {p}")

    with open(OUT, "w") as f:
        json.dump({"events": events}, f, indent=1, sort_keys=True)
        f.write("\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
