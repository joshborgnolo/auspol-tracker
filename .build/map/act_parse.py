#!/usr/bin/env python3
"""act_parse.py — the ACT /map/ frames' source-reader and oracle bank.

Reads the Elections ACT mirrors under .build/state-flow-src/act/<year>/
(harvest-act-src.py's own mirror-verified family): each era's Statistics
workbook owns per-electorate per-candidate FP tallies on its `<Prefix>CanSum`
sheets, `<Prefix>PP` per-venue rows, an aggregate `Summary` sheet that
prints per-electorate per-party tallies beside its own Formal/Informal/
Total tail rows, and per-electorate Enrolment rows. Adjacent first-party
lanes mirror alongside it:

  elected.html — Elections ACT's own per-era elected-candidate list
                 pages. Body across years prints
                 "<Electorate> <Member Name> - <Party> <Name> - <Party> …"
                 in one flat flow.
  dop-*.xlsx   — per-electorate Hare-Clark distribution-of-preferences
                 workbooks (adjacent lane; the land here doesn't yet read).
  ballot-data/ — act24-only: the de-identified per-ballot mechanical
                 batch rows (adjacent lane as well).

The era-of-record per frame is electorally self-evident in the mirrors.
Cross-title body rows ride the workbook's per-electorate prefix
suite across years: Brin=Brindabella, Ginn=Ginninderra, Kurr=Kurrajong,
Murr=Murrumbidgee, Yerr=Yerrabi, Molo=Molonglo.

Deps: python3 stdlib + openpyxl. Guards fail loud.
"""
import html as _html
import json
import os
import re
import sys
from collections import Counter

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SFS = os.path.join(REPO, ".build", "state-flow-src", "act")

FRAMES = {
    "act16": {"day": "2016-10-15",
              "elects": ["Brindabella", "Ginninderra", "Kurrajong",
                         "Murrumbidgee", "Yerrabi"],
              "members": 5, "census": 2016},
    "act20": {"day": "2020-10-17",
              "elects": ["Brindabella", "Ginninderra", "Kurrajong",
                         "Murrumbidgee", "Yerrabi"],
              "members": 5, "census": 2021},
    "act24": {"day": "2024-10-19",
              "elects": ["Brindabella", "Ginninderra", "Kurrajong",
                         "Murrumbidgee", "Yerrabi"],
              "members": 5, "census": 2021},
    # parent-of-act16 only — never a frame of its own at this land.
    "act12": {"day": "2012-10-20",
              "elects": ["Brindabella", "Ginninderra", "Molonglo"],
              "members": 5,
              "members_by_div": {"Brindabella": 5, "Ginninderra": 5,
                                  "Molonglo": 7},
              "census": 2016},
}
PREFIXES = {"Brindabella": "Brin", "Ginninderra": "Ginn",
            "Kurrajong": "Kurr", "Murrumbidgee": "Murr",
            "Yerrabi": "Yerr", "Molonglo": "Molo"}

#: Elections ACT's CanSum sheets write a closed intra-workbook shorthand
#: (ALP, LIB, GREEN, SUST, AJP, BEL, UNG, FED, LDP, DLP, SFF, CLIM,
#: PROG, CAP) and its elected.html pages write the verbose plain-label
#: names — both vocab sets join here into one site tag per.
CANB_SHORT = {"ALP": "ALP", "LIB": "LIB", "GREEN": "GRN", "GREENS": "GRN",
              "CL": "LIB", "GRN": "GRN", "AJP": "AJP", "SUST": "SUST",
              "FFP": "FFP", "BELCO": "BELCO", "BEL": "BELCO",
              "CAP": "OTH", "CLIM": "OTH", "CLIMATE": "OTH",
              "FED": "OTH", "POL": "OTH", "PROG": "OTH", "LDP": "OTH",
              "DLP": "OTH", "SFF": "OTH", "UNG": "UNGRP",
              "FIONACARRICK": "UNGRP", "FIRSTNATION": "FIRSTNATION",
              "FIRST": "FIRSTNATION", "UNGRP": "UNGRP", "TB": "OTH"}

PARTY_TAGS = [
    ("ACTLabor", "ALP"), ("AustralianLaborParty", "ALP"),
    ("CanberraCampShoot", "SUST"),
    ("CanberraLiberals", "LIB"), ("LiberalParty", "LIB"),
    ("TheACTGreens", "GRN"), ("ACTGreens", "GRN"),
    ("AustralianGreens", "GRN"), ("TheGreens", "GRN"),
    ("AnimalJusticeParty", "AJP"),
    ("SustainableAustraliaParty", "SUST"), ("SustainableAustralia", "SUST"),
    ("FamilyFirst", "FFP"), ("BelcoParty", "BELCO"),
    ("LiberalDemocrats", "OTHH"),
    ("BelcoLabor", "ALP"), ("LibMoIndependent", "IND"),
    ("Ungrouped", "UNGRP"), ("Independent", "UNGRP"),
    ("IndependentsforCanberra", "UNGRP"),
    ("FirstNationParty", "FIRSTNATION"),
    ("FionaCarrickIndependent", "UNGRP"),
    ("CarrickIndependent", "UNGRP"),
    ("CommunityLabor", "ALP"), ("CommunityIndependent", "IND"),
]

BUCKET = {"ALP": "alp", "LIB": "lnp", "GRN": "grn",
          "UNGRP": "ind", "IND": "ind", "FIRSTNATION": "ind",
          "AJP": "oth", "SUST": "oth", "FFP": "oth",
          "BELCO": "oth", "OTHH": "oth", "OTH": "oth"}
TAG_TO_PRETTY = {
    "ALP": "ACT Labor", "LIB": "Canberra Liberals", "GRN": "The ACT Greens",
    "AJP": "Animal Justice Party", "SUST": "Sustainable Australia Party",
    "FFP": "Family First", "BELCO": "Belco Party",
    "FIRSTNATION": "First Nation Party",
    "UNGRP": "Independent", "IND": "Independent", "OTH": None,
}


def fail(msg):
    raise SystemExit(f"act-parse: {msg}")


def nk(s):
    return re.sub(r"[^A-Za-z0-9]+", "", str(s or "")).upper()


def clean_txt(s):
    return " ".join(str(s or "").split())


def tag_of(label):
    u = nk(label)
    if not u:
        return "UNGRP"
    if u in CANB_SHORT:
        return CANB_SHORT[u]
    for key_infix, tag in PARTY_TAGS:
        if nk(key_infix) == u:
            return tag
    for key_infix, tag in PARTY_TAGS:
        if nk(key_infix) in u and len(nk(key_infix)) >= 3:
            return tag
    if u.startswith("UNGRP"):
        return "UNGRP"
    return "TAG?" + u


def pretty_of(tag):
    return TAG_TO_PRETTY.get(tag, tag)


def bucket_of(tag):
    if tag.startswith("TAG?"):
        return "oth"
    return BUCKET.get(tag, "oth")


def nm_of(s):
    return " ".join(str(s or "").replace(",", "").upper().split())


def read_file(year, fname):
    p = os.path.join(SFS, year, fname)
    if not os.path.exists(p):
        fail(f"mirror file missing: {p}")
    return open(p, encoding="utf-8", errors="replace").read()


def plain(h):
    t = re.sub(r"<br[^>]*>", " ", h)
    t = re.sub(r"<[^>]+>", " ", t)
    return " ".join(_html.unescape(t).split())


def _xlsx(year):
    p = os.path.join(SFS, year, "stats.xlsx")
    if not os.path.exists(p):
        fail(f"statistics workbook missing for {year}")
    import openpyxl
    return openpyxl.load_workbook(p, read_only=True, data_only=True)


_LABEL_ROWS = {"formal", "informal", "formal votes", "informal votes",
               "informal ballot papers", "total ballots",
               "total ballots cast",
               "total", "grand total", "candidate", "candidates",
               "votes total", "total votes", "votes", "preference",
               "enrolment", "ballots"}


def read_can_sum(frame, div):
    """Per-electorate candidate rows from the stats workbook's
    `<Prefix>CanSum` sheet. Columns: name / party-abbr / ordinary (+share)
    / postal (+share) / early|prepoll (+share) / declaration (+share) /
    Total (+share) — the Total column is the right-most "Total" header
    across every era read here.
    """
    cfg = FRAMES[frame]
    year = cfg["day"][:4]
    pref = PREFIXES[div]
    want_prefix = pref + "CanSum"
    wb = _xlsx(year)
    sheet_name = None
    for s in wb.sheetnames:
        if s.lower() == want_prefix.lower():
            sheet_name = s
            break
    if sheet_name is None:
        fail(f"{frame}: workbook sheet {pref}CanSum missing ({wb.sheetnames})")
    ws = wb[sheet_name]
    rows = [[("" if c is None else c) for c in r]
            for r in ws.iter_rows(values_only=True)]
    if len(rows) < 3 or str(rows[0][0] or "").strip().lower() != "candidate":
        fail(f"{frame}/{div}: CanSum header drifted ({rows[0][:3]!r})")
    header = rows[0]
    tot_ix = max(i for i, c in enumerate(header)
                 if str(c or "").strip().lower() == "total")
    cand_rows = []
    for r in rows[1:]:
        if not any(c not in ("", " ", None) for c in r):
            continue
        nm = str(r[0] or "").strip()
        if not nm or nm.lower() == "group total":
            continue
        if nm.lower() in _LABEL_ROWS:
            continue
        v_tot = str(r[tot_ix] or "").strip()
        try:
            v_tot = int(float(v_tot or 0))
        except ValueError:
            fail(f"{frame}/{div}: row Total not numeric: "
                 f"{nm} = {r[tot_ix]!r}")
        abbr = str(r[1] or "").strip()
        if not abbr:
            fail(f"{frame}/{div}: candidate row without a party tag: {nm}")
        cand_rows.append({"n": clean_txt(nm), "pty": tag_of(abbr),
                          "abbr": abbr, "votes": v_tot})
    if not cand_rows:
        fail(f"{frame}/{div}: no candidate rows in {sheet_name}")
    return {"cands": cand_rows}


def _elected_by_flat(frame):
    """elected.html: '<Elect>: member - party member - party…' flat print
    across years. Each electorate's cluster lands in sequence on its era
    page body.
    """
    year = FRAMES[frame]["day"][:4]
    t = plain(read_file(year, "elected.html"))
    elects = FRAMES[frame]["elects"]
    pty_names = ("Canberra Liberals", "Australian Labor Party", "ACT Labor",
                 "The Greens", "The ACT Greens", "ACT Greens",
                 "Australian Greens",
                 "Animal Justice Party", "Independents for Canberra",
                 "Fiona Carrick Independent", "Independent",
                 "Family First", "First Nation Party", "Belco Party",
                 "Sustainable Australia Party")
    sorted_names = sorted(set(pty_names), key=len, reverse=True)
    pty_re = "|".join(re.escape(k) for k in sorted_names)
    row_pat = re.compile(r"([A-Z][a-zA-Z'’\-. ]+?)\s*[-,—–]\s+(" + pty_re + r")\b")
    out = {}
    pos = []
    for e in elects:
        m = re.search(rf"(?:^|\s){re.escape(e)}(?:&nbsp;|\s|$)", t)
        if m is None:
            print(f"warning: {frame}: electorate marker {e} missing in "
                  f"elected.html")
            continue
        pos.append((e, m.start()))
    pos.sort(key=lambda x: x[1])
    for ix, (e, i0) in enumerate(pos):
        end = pos[ix + 1][1] if ix + 1 < len(pos) else len(t)
        seg = t[i0 + len(e):end]
        names_here = []
        for mm in row_pat.finditer(seg):
            nm = clean_txt(mm.group(1)).rstrip(" ,-–—; ")
            if not nm or "\n" in nm or len(nm) > 48:
                continue
            pty_lab = mm.group(2)
            names_here.append({"n": nm, "pty": tag_of(pty_lab)})
        out[e] = names_here
    return out


def _summary_rows(frame):
    """The era-workbook `Summary` sheet: per-electorate per-party vote
    tallies beside its own Formal / Informal / Total tail rows."""
    year = FRAMES[frame]["day"][:4]
    wb = _xlsx(year)
    if "Summary" not in wb.sheetnames:
        fail(f"{frame}: Summary sheet missing")
    ws = wb["Summary"]
    rows = [[("" if c is None else c) for c in r]
            for r in ws.iter_rows(values_only=True)]
    elects = FRAMES[frame]["elects"]
    head = [str(c or "").strip() for c in rows[0]]
    h_ix = {str(h or "").strip(): i for i, h in enumerate(head)
            if str(h or "").strip()}
    want_ix = {d: h_ix.get(d) for d in elects}
    for dv, ix in want_ix.items():
        if ix is None:
            fail(f"{frame}: Summary header lacks electorate column {dv}")
    out = {"parties": {}, "formal": {}, "informal": {}, "total": {}}
    for r in rows[1:]:
        tag_cell = str(r[0] or "").strip()
        if not tag_cell:
            continue
        label_low = tag_cell.lower()
        tgt = None
        if label_low == "formal":
            tgt = out["formal"]
        elif label_low == "informal":
            tgt = out["informal"]
        elif label_low == "total":
            tgt = out["total"]
        else:
            tgt = out["parties"]
        for d, ix in want_ix.items():
            v = int(float(r[ix] or 0))
            tgt[d] = tgt.get(d, 0) + v
    return out


def _enrolment_rows(frame):
    year = FRAMES[frame]["day"][:4]
    wb = _xlsx(year)
    if "Enrolment" not in wb.sheetnames:
        fail(f"{frame}: Enrolment sheet missing")
    ws = wb["Enrolment"]
    rows = [[("" if c is None else c) for c in r]
            for r in ws.iter_rows(values_only=True)]
    out = {}
    for r in rows:
        a = str(r[0] or "").strip()
        if not a or a.lower().startswith("enrolment") or a.lower() == "total":
            continue
        b = int(float(r[1])) if len(r) > 1 else 0
        if b > 0:
            out[a] = b
    return out


def load_frame(frame):
    """The frame's one full record: per-electorate candidate FP tallies,
    elected rosters, formal/informal/enrolled lanes — every source
    cross-checked against at least one in-workbook sibling lane before
    any figure may leave this function."""
    cfg = FRAMES[frame]
    cands, formal, informal, enrolled, elected = {}, {}, {}, {}, {}
    elected = _elected_by_flat(frame)
    summ = _summary_rows(frame)
    enrol_rows = _enrolment_rows(frame)
    total_elected = 0
    for dv in cfg["elects"]:
        cs = read_can_sum(frame, dv)
        cands[dv] = cs["cands"]
        cand_sum = sum(c["votes"] for c in cs["cands"])
        summ_formal = summ["formal"].get(dv)
        if summ_formal is None or cand_sum != summ_formal:
            fail(f"{frame}/{dv}: cansum votes {cand_sum} != summary's "
                 f"own Formal {summ_formal}")
        formal[dv] = cand_sum
        informal[dv] = summ["informal"].get(dv)
        enrolled[dv] = enrol_rows.get(dv)
        if elected.get(dv) is None:
            fail(f"{frame}: electorate {dv} absent in elected page")
        mb = cfg.get("members_by_div", {}).get(dv, cfg.get("members", 5))
        n_elect = len(elected[dv])
        if n_elect != mb:
            fail(f"{frame}/{dv}: elected register carries {n_elect} "
                 f"of its {mb}")
        total_elected += n_elect
    assert total_elected == (17 if frame == "act12" else 25), \
        (frame, total_elected)
    return {"frame": frame, "cfg": cfg, "cands": cands, "elected": elected,
            "formal": formal, "informal": informal, "enrolled": enrolled}


def load(frame):
    if frame not in FRAMES:
        fail(f"act frame {frame} unknown")
    cfg = FRAMES[frame]
    return {"frame": frame, "cfg": cfg, "year": cfg["day"][:4]}
