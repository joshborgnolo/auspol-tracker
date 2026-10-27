#!/usr/bin/env python3
"""Scratch drift-map generator: XLS vs 2CP-annex, venue by venue, per district.

Prints the BOOTH_TCP_DRIFT literal to pin in build_vic22_data.py. Not part of
the build. Assumes nepean.xls is the repaired Wayback 2022-general file.
Mirrors parse_annex's six-cell row grammar exactly.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import warnings
warnings.simplefilter("ignore")
from build_vic22_data import XLS_DIR, ANNEX_DIR, parse_district, txt  # noqa: E402


def annex_rows(slug):
    """(per-venue (a,b,ms,inf,tot), district total row) from the 2CP annex."""
    page = open(os.path.join(ANNEX_DIR, slug + ".html"),
                encoding="utf-8").read()
    tab = re.findall(r"<table[^>]*>.*?</table>", page, re.S | re.I)[0]
    rows = []
    for tr in re.findall(r"<tr.*?</tr>", tab, re.S | re.I):
        rows.append([txt(cell) for cell in
                     re.findall(r"<t[dh][^>]*>.*?</t[dh]>", tr, re.S | re.I)])
    idx = 2
    per_venue = {}
    while idx < len(rows) and rows[idx][0] != "Ordinary votes total":
        r = rows[idx]
        per_venue[r[0]] = tuple(int(r[c]) for c in range(1, 6))
        idx += 1
    tot = None
    while idx < len(rows):
        r = rows[idx]
        idx += 1
        if r and r[0] == "Total":
            tot = tuple(int(r[c]) for c in range(1, 6))
            break
    assert tot is not None, slug
    return per_venue, tot


drift = {}
tcp_off = []
for fn in sorted(os.listdir(XLS_DIR)):
    if not fn.endswith(".xls"):
        continue
    slug = fn[:-4]
    x = parse_district(os.path.join(XLS_DIR, fn))
    aven, (ta, tb, tms, tinf, ttot) = annex_rows(slug)
    x_by_name = {v["n"]: v for v in x["venues"]}
    ent = {}
    miss = sorted(set(x_by_name) - set(aven))
    extra = sorted(set(aven) - set(x_by_name))
    if miss:
        ent["miss"] = miss
    if extra:
        ent["extra"] = extra
    ven = {}
    for vn in sorted(set(x_by_name) & set(aven)):
        a, b, ms, inf, tot = aven[vn]
        xv = x_by_name[vn]
        d_inf = inf - xv["inf"]
        d_tot = tot - xv["tot"]
        if d_inf or d_tot:
            ven[vn] = [d_inf, d_tot]
        if a + b + ms != sum(xv["v"]):
            tcp_off.append((slug, vn, a + b + ms - sum(xv["v"])))
    if ven:
        ent["ven"] = ven
    sums = [ta + tb + tms - x["formal"], tinf - x["informal"], ttot - x["total"]]
    if sums != [0, 0, 0]:
        ent["sums"] = sums
    if ent:
        drift[slug] = ent

print(f"# districts with any drift: {len(drift)}")
print("BOOTH_TCP_DRIFT = {")
for slug in sorted(drift):
    print(f"    {slug!r}: {drift[slug]!r},")
print("}")
print(f"# per-venue tcp-sum mismatches: {len(tcp_off)}")
for s in tcp_off[:40]:
    print("#  ", s)
