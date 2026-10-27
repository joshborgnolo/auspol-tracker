#!/usr/bin/env python3
"""Scratch vintage arbiter: XLS vs 2CP annex vs recheck web block per district.
Not part of the build; prints the reconciliation table."""
import os
import re
import sys
import html as H

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import warnings
warnings.simplefilter("ignore")
from build_vic22_data import XLS_DIR, ANNEX_DIR, parse_district, txt, flat_name  # noqa: E402

SF_DIR = os.path.join(HERE, "..", "state-flow-src", "vic", "2022")


def annex_total(slug):
    page = open(os.path.join(ANNEX_DIR, slug + ".html"), encoding="utf-8").read()
    tab = re.findall(r"<table[^>]*>.*?</table>", page, re.S | re.I)[0]
    rows = [[txt(c) for c in re.findall(r"<t[dh][^>]*>.*?</t[dh]>", tr, re.S | re.I)]
            for tr in re.findall(r"<tr.*?</tr>", tab, re.S | re.I)]
    pair = [flat_name(rows[0][1]), flat_name(rows[0][2])]
    tot = None
    nven = 0
    for r in rows[2:]:
        if not r or not r[0]:
            continue
        if r[0] == "Total":
            tot = [int(x) for x in r[1:6]]
        elif r[0] not in ("Ordinary votes total",) and not r[0].endswith("votes") \
                and not r[0].startswith("Percentage"):
            nven += 1
    return {"pair": pair, "tot": tot, "nvenues": nven}


def recheck(slug):
    p = os.path.join(SF_DIR, slug + "-district-results.html")
    if not os.path.exists(p):
        return None
    page = open(p, encoding="utf-8").read()
    figs = {}
    for m in re.finditer(r'<p class="list-item-title">([^<]+)</p>\s*<p class="list-item-body">([^<]+)</p>', page):
        lab, val = m.group(1).strip(), m.group(2).strip().replace(",", "")
        v = re.match(r"\d+", val)
        if v:
            figs[lab] = int(v.group())
    cands = {}
    m = re.search(r"Recheck first preference votes.*?<table>(.*?)</table>", page, re.S)
    if m:
        for tr in re.findall(r"<tr.*?</tr>", m.group(1), re.S | re.I):
            cells = [H.unescape(re.sub(r"<[^>]+>", "", c)).strip()
                     for c in re.findall(r"<t[dh][^>]*>.*?</t[dh]>", tr, re.S | re.I)]
            if len(cells) >= 4 and cells[0] != "Candidate":
                cands[flat_name(cells[0])] = int(cells[2].replace(",", ""))
    return {"f": figs.get("Formal votes:"), "i": figs.get("Informal votes:"),
            "t": figs.get("Total votes:"), "e": figs.get("Total enrolment as at close of rolls:"),
            "cands": cands}


print(f"{'district':22s} {'XLS-enr':>8s} {'RC-enr':>8s} | {'XLS-frm':>7s} {'AX-frm':>7s} {'RC-frm':>7s} | {'XLS-inf':>7s} {'AX-inf':>7s} {'RC-inf':>7s} | {'XLS-tot':>7s} {'AX-tot':>7s} {'RC-tot':>7s}  flags")
n_cand_mismatch = 0
for fn in sorted(os.listdir(XLS_DIR)):
    if not fn.endswith(".xls"):
        continue
    slug = fn[:-4]
    x = parse_district(os.path.join(XLS_DIR, fn))
    a = annex_total(slug)
    r = recheck(slug)
    if a["tot"] is None or r is None:
        print(f"{slug:22s} annex-total={a['tot']} recheck={'no' if r is None else 'yes'} xls-venues={len(x['venues'])} annex-venues={a['nvenues']}")
        continue
    apms = a["tot"][0] + a["tot"][1] + a["tot"][2]
    flags = []
    if not (x["formal"] == apms and x["informal"] == a["tot"][3] and x["total"] == a["tot"][4]):
        flags.append("X!=A")
    if not (x["formal"] == r["f"] and x["informal"] == r["i"]):
        flags.append("X!=R(split)")
    if x["total"] != r["t"]:
        flags.append("X!=R(tot)")
    if a["tot"][4] != r["t"]:
        flags.append("A!=R(tot)")
    if apms != r["f"]:
        flags.append("A!=R(form)")
    cm = [n for n, v in x["formalOf"].items() if r["cands"] and r["cands"].get(n) != v] if r["cands"] else []
    if cm:
        n_cand_mismatch += 1
        flags.append(f"X!=Rc({len(cm)}/{len(r['cands'])})")
    if len(x["venues"]) != a["nvenues"]:
        flags.append(f"VEN{len(x['venues'])}v{a['nvenues']}")
    print(f"{slug:22s} {x['enrolled']:>8d} {r['e'] or 0:>8d} | {x['formal']:>7d} {apms:>7d} {r['f'] or 0:>7d} | "
          f"{x['informal']:>7d} {a['tot'][3]:>7d} {r['i'] or 0:>7d} | {x['total']:>7d} {a['tot'][4]:>7d} {r['t'] or 0:>7d}  {' '.join(flags)}")

print()
print("districts with per-candidate recheck mismatch:", n_cand_mismatch)
