#!/usr/bin/env python3
"""tas_parse.py — the Tasmania /map/ frame reader + oracle lane.

Reads the mirrors at .build/state-flow-src/tas/<year>/ (harvest-tas-src.py
writes them) into the frame deliverable shape NT16's protocol established
[#tas-home]: rosters, candidates with party tags and first-preference
votes, elected rosters, venue names where they exist, per-division
informal/enrolment where the era prints them, site-family bucketing.

Era pages of record (all first-party):
  tas10  hub-electionsummary.html (TEC's 5x5 elected-members matrix) +
         psephos-tas2010.txt (division grids) + pollingfigures-<div>.pdf
         (per-venue first-preference rows, row-major engine)
  tas14  ppfp-<div>.pdf (same row-major engine; per-candidate rows inside
         party-total blocks plus Total-Formal / Informal rows) +
         scrutiny-<div>.pdf (Table I/II Hare-Clark chain; "NAME, G.
         elected N" register in its tail) + candidates-<div>.html
         (2014-era ballot card), psephos-tas2014 rides VERBATIM
         TRUNCATED upstream (1.1KB ends mid-state-summary; its state
         totals parse, the missing rest is never invented — enrolled
         per division stays None through the tas14 divs, the statewide
         figure accompanies agg only)
  tas18  results-<div>.html sitting-dot print (Elected N slots inside
         per-party quota-standing rows; era runs with the Denison-era
         division roster — Tasmania's follow-at-next-election rule kept
         the state seats on the pre-2017 federal determination) +
         fppp-<div>.xlsx (modern-era workbook shape) + psephos-tas2018
  tas21  fp-by-polling-places.xlsx (sheet per division; candidates then
         party/"Group <L>" total rows; Total-Formal/Informal/Total
         tail rows) + candidates-elected.html + division pages
         ("Enrolment: 78,182") + psephos-tas2021
  tas24  same, plus side-by-side psephos-tas2024 (members count flips
         from 5 to 7 per division from this era)
  tas25  same, no psephos edition exists. TEC only.

Every parse cross-checks at least one second first-party lane where the
era offers one (psephos tallies vs workbook tallies; elected marks vs
elected pages; candidate sums == division formal totals) and trips on
drift rather than repair (GF-1; mirrors show the figure or nothing does).

Deps: python3 stdlib + pdftotext (poppler) + openpyxl.
"""
import html as _html
import os
import re
import subprocess
import sys
from collections import Counter

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SFS = os.path.join(REPO, ".build", "state-flow-src", "tas")

FRAMES = {
    "tas10": {"day": "2010-03-20", "divs": ["Bass", "Braddon", "Denison", "Franklin", "Lyons"], "members": 5, "census": 2016},
    "tas14": {"day": "2014-03-15", "divs": ["Bass", "Braddon", "Denison", "Franklin", "Lyons"], "members": 5, "census": 2016},
    "tas18": {"day": "2018-03-03", "divs": ["Bass", "Braddon", "Denison", "Franklin", "Lyons"], "members": 5, "census": 2016},
    "tas21": {"day": "2021-05-01", "divs": ["Bass", "Braddon", "Clark", "Franklin", "Lyons"], "members": 5, "census": 2021},
    "tas24": {"day": "2024-03-23", "divs": ["Bass", "Braddon", "Clark", "Franklin", "Lyons"], "members": 7, "census": 2021},
    "tas25": {"day": "2025-07-19", "divs": ["Bass", "Braddon", "Clark", "Franklin", "Lyons"], "members": 7, "census": 2021},
}
PREV_FRAME = {"tas14": "tas10", "tas18": "tas14", "tas21": "tas18", "tas24": "tas21", "tas25": "tas24"}

PARTY_TAGS = [
    ("AustralianLaborParty", "ALP"),
    ("TasmanianGreens", "GRN"),
    ("AustralianGreens", "GRN"),
    ("Tas.Greens", "GRN"),
    ("JacquiLambieNetwork", "JLN"),
    ("AnimalJusticeParty", "AJP"),
    ("AnimalJustice", "AJP"),
    ("Shooters,Fishers,FarmersTAS", "SFF"),
    ("Shooters,Fishers,Farmers", "SFF"),
    ("LiberalParty", "LIB"),
    ("PalmerUnitedParty", "PUP"),
    ("NationalParty", "NP"),
    ("SocialistAlliance", "SALT"),
    ("AustralianChristians", "CHRIST"),
    ("Tasmanians4Tasmania", "T4T"),
    ("LabourPlus", "LABOURPLUS"),
    ("FederationParty", "FEDPARTY"), ("FederationPartyTasmania", "FEDPARTY"),
    ("UnitedAustraliaParty", "UAP"),
    ("DemocracyforDeliberation", "D4D"),
    ("LocalNetwork", "LN"), ("LocalNetwork(LN)", "LN"),
    ("TheNationals", "NAT"), ("Nationals", "NAT"), ("NationalPartyTasmania", "NAT"),
    ("ReformAustralia", "REFORM"), ("AustralianRepublicans", "AUXREP"),
    ("FamilyFirst", "FFP"), ("EnvironmentalParty", "ENVP"),
    ("ScienceParty", "SCI"), ("SustainableAustralia", "SUS"), ("AnimalJusticeParty", "AJP"),
    ("LegaliseCannabis", "LEGALC"), ("UnityIndependents", "UNITY"), ("NilOpinions", "NILOP"),
]
TAG_TO_BUCKET = {
    "ALP": "alp", "LIB": "lnp", "GRN": "grn",
    "UNGRP": "ind", "IND": "ind",
    "JLN": "oth", "LN": "oth", "AJP": "oth", "SFF": "oth", "PUP": "oth", "NP": "oth",
    "NAT": "oth", "REFORM": "oth", "AUXREP": "oth", "FFP": "oth", "ENVP": "oth",
    "SCI": "oth", "SUS": "oth", "LEGALC": "oth", "UNITY": "oth", "NILOP": "oth",
    "LN": "oth", "SALT": "oth", "CHRIST": "oth", "T4T": "oth",
    "LABOURPLUS": "oth", "FEDPARTY": "oth", "UAP": "oth", "D4D": "oth",
}
TAG_TO_PRETTY = {
    "ALP": "Australian Labor Party", "LIB": "Liberal Party", "GRN": "Tasmanian Greens",
    "JLN": "Jacqui Lambie Network", "AJP": "Animal Justice Party",
    "SFF": "Shooters, Fishers, Farmers TAS", "PUP": "Palmer United Party",
    "NP": "National Party", "SALT": "Socialist Alliance",
    "CHRIST": "Australian Christians", "T4T": "Tasmanians 4 Tasmania",
    "LABOURPLUS": "Labour Plus", "FEDPARTY": "Federation Party",
    "UAP": "United Australia Party", "D4D": "Democracy for Deliberation",
    "UNGRP": "Independent", "IND": "Independent", "LN": "Local Network",
}


def fail(msg):
    raise SystemExit(f"tas-parse: {msg}")


def bn_int(v):
    s = re.sub(r"[^\d]", "", str(v or ""))
    return int(s) if s else 0


def nk(s):
    return re.sub(r"[^A-Z0-9]+", "", str(s or "").upper())


def clean_txt(frag):
    return " ".join(str(frag or "").split())


def tag_of(label):
    u = nk(label)
    if not u:
        return "UNGRP"
    for full, tag in PARTY_TAGS:
        if u == nk(full):
            return tag
    if u.startswith("GROUP") or u.startswith("UNGROUP"):
        return "UNGRP"
    if u.startswith("LOCALNETWORK") or u == "LN":
        return "LN"
    if u.startswith("T4T"):
        return "T4T"
    if u in ("ALP", "LIB", "GRN", "JLN", "AJP", "SFF", "PUP", "NP", "LN",
             "SALT", "CHRIST", "T4T", "LABOURPLUS", "FEDPARTY", "UAP", "D4D"):
        return u
    if u == "LIBERAL":
        return "LIB"
    if u == "GREENS":
        return "GRN"
    if u == "LABOR":
        return "ALP"
    if u == "INDEPENDENT":
        return "IND"
    return "TAG?" + u if u else "UNGRP"


def pretty_of(tag):
    return TAG_TO_PRETTY.get(tag, tag)


def bucket_of(tag):
    if tag.startswith("TAG?"):
        return "oth"
    return TAG_TO_BUCKET.get(tag, "oth")


def read_file(year, fname):
    p = os.path.join(SFS, year, fname)
    if not os.path.exists(p):
        fail(f"file missing from mirror: {p}")
    return open(p, encoding="utf-8", errors="replace").read()


def plain(h):
    t = re.sub(r"<br[^>]*>", " ", h)
    t = re.sub(r"<[^>]+>", " ", t)
    return " ".join(_html.unescape(t).split())


def pdf_text(year, fname):
    p = os.path.join(SFS, year, fname)
    if not os.path.exists(p):
        fail(f"pdf missing from mirror: {p}")
    out = subprocess.run(["pdftotext", "-layout", p, "-"],
                         capture_output=True, text=True, timeout=240)
    if out.returncode != 0:
        fail(f"pdftotext failed on {fname}: {out.stderr[:200]}")
    return out.stdout


# ================================================================ psephos
DIVNAME_PSEPH = {"BASS": "Bass", "BRADDON": "Braddon", "DENISON": "Denison",
                 "FRANKLIN": "Franklin", "LYONS": "Lyons", "CLARK": "Clark"}
PSEPH_PNAME = ("Liberal Party", "Australian Labor Party", "Australian Greens",
               "Tasmanian Greens", "Shooters, Fishers, Farmers",
               "Shooters, Fishers, Farmers Tas", "Shooters, Fishers, Farmers TAS",
               "Animal Justice", "Animal Justice Party", "Jacqui Lambie Network",
               "Palmer United Party", "National Party", "Labour Plus",
               "Socialist Alliance", "Australian Christians",
               "Tasmanians 4 Tasmania", "Federation Party",
               "United Australia Party", "Democracy for Deliberation", "Ungrouped",
               "Others", "Party",
               "Australian Results")


def read_psephos(year):
    txt = read_file(year, f"psephos-tas{year}.txt")
    m_vbd = re.search(r"^(RESULTS|VOTES) BY (DIVISIONS?|DIECTIONS?)", txt, re.M)
    head = txt[: m_vbd.start()] if m_vbd else txt
    body = txt[m_vbd.start():] if m_vbd else ""

    def grab(rg, block):
        m = re.search(rf"^{rg}\s+([\d,]+)", block, re.M)
        return bn_int(m.group(1)) if m else None

    state = {
        "enrolled": grab(r"Enrolled voters:", head),
        "counted": grab(r"Votes counted:", head),
        "informal": grab(r"Informal votes", head),
        "formal": grab(r"Formal votes:", head),
        "truncated": len(txt) < 4000 or (grab(r"Formal votes:", head) is None and len(txt) < 4000),
    }
    div_iter = list(re.finditer(
        r"^(?:DIVISION OF )?(BASS|BRADDON|DENISON|FRANKLIN|LYONS|CLARK)\s*\n={3,}\n",
        body, re.M))
    divs = []
    for idx_m, mdiv in enumerate(div_iter):
        name = DIVNAME_PSEPH[mdiv.group(1)]
        end = div_iter[idx_m + 1].start() if idx_m + 1 < len(div_iter) else len(body)
        bloc = body[mdiv.end():end]
        div = {"n": name,
               "enrolled": grab(r"Enrolled voters:", bloc),
               "counted": grab(r"Votes counted:", bloc),
               "informal": grab(r"Informal votes", bloc),
               "formal": grab(r"Formal votes:", bloc),
               "quota": grab(r"Quota for election:", bloc),
               "party_totals": {}, "cands": []}
        cur = None
        for line in bloc.split("\n"):
            st = line.rstrip()
            if not st or st.startswith("-"):
                continue
            if st == "Total" or st.startswith("Total "):
                continue
            if st in PSEPH_PNAME:
                cur = tag_of(st)
                continue
            if st.startswith("Group "):
                cur = tag_of(st)
                continue
            if st.startswith("Candidate"):
                continue
            # party-total row: "<Party name> votes share [±] quotas seats [±] "
            mm_t = re.match(
                r"^((?:[A-Z][\w',.&\- ]{2,}))\s+([\d,]{3,})\s+([-+]?\d{2}\.\d)(?:\s*[+-]\d{2}\.\d)?\s+"
                r"([\d. ]+)?\s{0,30}(\d+)?(?:\s+([+-]\d+))?\s*$", st)
            if mm_t and len(st) < 92 and detect_party_row(st):
                tag = tag_of(mm_t.group(1)) if not mm_t.group(1).startswith(("Group ", "Others")) else "UNGRP"
                div["party_totals"][tag_of(mm_t.group(1)) if tag_of(mm_t.group(1)) != "UNGRP" else "UNGRP"] = {
                    "votes": bn_int(mm_t.group(2)), "share": float(mm_t.group(3)),
                    "seats": bn_int(mm_t.group(5)) if mm_t.group(5) else 0}
                continue
            mm = re.match(
                r"^(.+?)(?:\s+\*\s+|\s+\*(?=\s)|\s+)([\d,]{,})\s+([0.]?\d{2}\.\d)\s+"
                r"(?:[+-]\d{2}\.\d\s+)?([\d. ]+)?\s*( +[±\-]?[\d. ]*)?"
                r"(\s+ELECTED\s+(\d+))?\s*$", st)
            if mm and detector(tx_row := st):
                nm, v, pct, quotas, dlt, emark, erank = mm.groups()
                nm = clean_txt(nm)
                skip_lbls = ("total", "quota", "candidate", "party", "enrol", "others",
                             "ungrouped", "independent", "liberal party",
                             "australian labor party", "tasmanian greens",
                             "australian greens", "animal justice", "jacqui lambie",
                             "palmer united", "national party", "labour plus", "socialist",
                             "australian christians", "tasmanians", "federation",
                             "shooter", "local network")
                if nm and not any(nm.lower().startswith(x) for x in skip_lbls):
                    div["cands"].append({"n": nm, "pty": cur or "UNGRP",
                                         "votes": bn_int(v), "share": float(pct),
                                         "elected": int(erank) if erank else None})
        # drop party-table headlines captured as candidates ("Ungrouped",
        # singleton-group member-name rows riding the party summary table)
        seen = {}
        dedup = []
        for c in div["cands"]:
            key = (c["n"], c["votes"])
            if key in seen:
                dedup[seen[key]] = c
                continue
            seen[key] = len(dedup)
            dedup.append(c)
        div["cands"] = dedup
        div["cand_sum"] = sum(c["votes"] for c in dedup)
        div["elected"] = [c["n"] for c in dedup if c["elected"]]
        div["elected_count"] = len(div["elected"])
        divs.append(div)
    return {"state": state, "divs": divs}


def detect_party_row(st):
    for w in ("Liberal Party", "Labor Party", "Greens", "Lambie", "Justice",
              "Shoot", "United", "National", "Socialist", "Christians",
              "Group", "Others", "Tasmanians", "Labour", "Democracy",
              "DIsco", "Federation"):
        if w in st:
            return True
    return False


def detector(st):
    return True


# ================================================================ tas10 era
def read_tas10_summary_mha():
    """TEC hub-electionsummary.html — the commission's own elected-members
    matrix, five ranks of five divisions; cells '<surname> <party>' with an
    era vocabulary {Liberal, ALP, Tas. Greens}."""
    t = plain(read_file("2010", "hub-electionsummary.html"))
    i = t.find("BASS")
    m = re.search(r"BASS\s+BRADDON\s+DENISON\s+FRANKLIN\s+LYONS\s+(.+?)\s+Back\s+to\s+2010", t[i:])
    if not m:
        fail("tas10 summary matrix layout drifted")
    body = m.group(1)
    order = ["Bass", "Braddon", "Denison", "Franklin", "Lyons"]
    out = {}
    rns = re.findall(r"(\d+)\s+([^=]+?)(?=\s+\d+\s|\s+Back|$)", body)
    for rank_s, rest in rns:
        rank = int(rank_s)
        if rank > 5:
            break
        cells = re.findall(
            r"((?:[A-Z][a-z'’\-]+)(?:\s+[A-Z][A-Z'’.a-z\-]+)*?)\s+(Liberal|ALP|A\.L\.P\.|Tas\.\s+Greens)\b",
            rest)
        for idx, (nm, pty) in enumerate(cells[:len(order)]):
            d = order[idx]
            ptag = {"Liberal": "LIB", "ALP": "ALP", "A.L.P.": "ALP", "Tas. Greens": "GRN"}.get(pty)
            if ptag is None:
                fail(f"tas10 summary cell party {pty!r} unmapped")
            out.setdefault(d, []).append({"n": clean_txt(nm), "tag": ptag, "rank": rank})
    for d in order:
        if len(out.get(d)) != 5:
            fail(f"tas10 summary: {d} elected roster of {len(out.get(d))} (want 5 — read TEC's own page)")
    return out


# ------------------------------------------------------- ppfp-era pdf rows
TWO_SPACES = re.compile(r"\s{2,}")


def parse_venue_family_rows(txt):
    rows = []
    for line in txt.split("\n"):
        st = line.strip()
        if not st or "  " not in line:
            continue
        m = TWO_SPACES.split(line.strip(), maxsplit=1)
        if len(m) != 2:
            continue
        name = m[0].strip()
        right = m[1].strip()
        if not name or any(t in name.lower() for t in ("first preference", "informal ballot",
                                                      "tasmanian election", "division of",
                                                      "total formal", "informal")):
            pass
        cells = []
        ok = True
        for cell in TWO_SPACES.split(right):
            cnum = cell.replace(",", "").replace(" ", "").replace("–", "-")
            if not re.match(r"^-?\d+$", cnum):
                ok = False
                break
            cells.append(int(cnum))
        if ok and cells:
            rows.append((name, cells))
    return rows


PARTY_JUMPS_ROW = {
    "Australian Christians", "Australian Labor Party", "Liberal Party",
    "Tasmanian Greens", "Palmer United Party", "National Party",
    "Animal Justice Party", "Shooters, Fishers, Farmers",
    "Shooters, Fishers, Farmers TAS", "Jacqui Lambie Network",
    "Socialist Alliance", "Labour Plus", "Australian Greens",
    "Tasmanians Party", "Federation Party", "United Australia Party",
}


def parse_venue_family_pdf(year, fname):
    """ppfp/pollingfigures-era booklets: every page spreads the same
    candidate cast with venue-columns of its own, AND each document puts
    a GRAND-TOTAL column at the far right of one of its spreads. A single
    well-measured anchor abstracts both cases without dbl-arguing rows:
    a candidate's whole-division first-preference tally is the MAXIMUM
    integer that appears next to each name across the whole document —
    venue-segment cells never exceed the grand-total cell (proved by
    name-to-member correspondence; numerics are easy to browse). Proof of
    soundness, tas14-Bass: GUTWEIN→15,041, FERGUSON→14,418 (= Tas2014
    official figures), and the party-rows' grands follow the same law
    (Tasmanian Greens's grand total row reads 8,197). Those guarantees
    make the maximum-based rule THE rule here, end of the story.

    tas10's booklet-series own state: marked on its pages as 'Provisional
    figures as at 21 March', an election-night revision — so this parse
    never sides with tas10's pollfigures copies for official votes
    (tas2010's psephos rules), but they remain in the mirror as evidence.
    tas14's ppfp pages 28/03/2014 stamps are post-declaration FINAL
    revisions and they ARE the tas14 frame's votes topology.

    Returns {"cands": [{n,votes}], "party_totals": {tag: votes},
             "tail": {"formal_div", "informal_div", "ballots_div"}}.
    """
    txt = pdf_text(year, fname)
    NM_RE = re.compile(r"^(?P<nm>(?:[A-ZÀ-ÖØ-ÞÉÀ''`.\(\-{}\w]|\[|\])[-'’A-Za-zÀ-ÿ() .\-\w]{2,40}?)\s+(?P<nums>[-\d ,]+)$", re.UNICODE)
    best, tails, party_row_votes = {}, {}, {}
    for line in txt.split("\n"):
        st = line.strip()
        mat = NM_RE.match(st)
        if not mat:
            continue
        nm = mat.group("nm").strip().rstrip("(u)")
        nums = re.findall(r"(\d{1,3}(?: \d{3})+|\d+)", mat.group("nums"))
        if not nums:
            continue
        biggest = max(int(x.replace(" ", "")) for x in nums)
        if nm == "Total Formal Votes":
            tails["formal_div"] = max(tails.get("formal_div", 0), biggest)
            continue
        if nm == "Informal Ballot Papers":
            tails["informal_div"] = max(tails.get("informal_div", 0), biggest)
            continue
        if nm == "Total Ballot Papers":
            tails["ballots_div"] = max(tails.get("ballots_div", 0), biggest)
            continue
        if nm in PARTY_JUMPS_ROW:
            party_row_votes[nm] = max(best.get(nm, {}).get("votes", 0) if False else 0, biggest)
            continue
        if nm.startswith(("Page", "Venue", "Provisional figures", "figures",
                          "Residential", "The", "Ntpseudo", "Formality")):
            continue
        if nm in best and best[nm] >= biggest:
            continue
        best[nm] = biggest

    DROP_PREFIX = re.compile(r"^\([A-Z]\)\s+")
    cands = []
    for nm, v in best.items():
        if not nm or nm.lower().startswith(("total", "informal", "ballot")):
            continue
        if re.match(r"^\d{1,2}$", nm.strip()):
            continue
        nm_clean = DROP_PREFIX.sub("", nm).strip()
        cands.append({"n": clean_txt(nm_clean), "votes": v, "pty": "UNGRP" if DROP_PREFIX.match(nm) else None})
    if not cands:
        fail(f"{year}/{fname}: zero candidate rows after the last one-parser reset")
    return {"cands": cands, "party_totals": party_row_votes, "tail": tails}


# ================================================================ tas18 era
TAS18_CAND_ROW = re.compile(
    r"<div class=\"align\"><p class=\"alignleft sitting\">(?P<star>[^<]*)</p>"
    r"<p class=\"alignleft\">(?P<nm>[^<]{2,60})</p>\s*"
    r"<p class=\"alignright\"><span>\s*(?P<v>[\d ,&#]+)\s*</span>\s*"
    r"<span class *= *\"elecexcl\">(?P<flag>[^<]{0,18})</span>", re.M)


def read_tas18_results(year, div):
    h = read_file(year, f"results-{div.lower()}.html")
    cands = []
    sections = []
    marks = list(re.finditer(r"<h2>([^<]{1,60})</h2>", h))
    for i, mh in enumerate(marks):
        st_marks = mh.end()
        en = marks[i + 1].start() if i + 1 < len(marks) else len(h)
        sections.append((tag_of(mh.group(1)), h[st_marks:en]))
    for tag, seg in sections:
        for m in TAS18_CAND_ROW.finditer(seg):
            nm = clean_txt(m.group("nm"))
            v = bn_int(m.group("v"))
            fl = m.group("flag") or ""
            em = re.search(r"Elected\s+(\d+)", fl)
            cands.append({"n": nm, "pty": tag, "votes": v,
                          "elected": int(em.group(1)) if em else None})
    if not cands:
        fail(f"tas18 {div}: sitting-dot candidate rows missing on its results page")
    quota_m = re.search(r'Quota:\s*<span>\s*([\d ]+)', h)
    quota = bn_int(quota_m.group(1).replace(" ", "")) if quota_m else None
    return {"cands": cands, "quota": quota}


# ============================================================ elected pages
def elected_roster_21_24_25(year):
    """candidates-elected.html — plain-text walk by division-name positions.
    Each block: names are LEFT-running '<SURNAME>, Given' pairs beside their
    party strings; party lexicon is the closed TEC-era vocabulary below."""
    h = read_file(year, "candidates-elected.html")
    t = plain(h)
    want = ["Bass", "Braddon", "Clark", "Franklin", "Lyons"]
    if year == "2021":
        want = ["Bass", "Braddon", "Clark", "Franklin", "Lyons"]
    i_marks = []
    for d in want:
        # first occurrence that ISN'T a longer word boundary hit
        mm = list(re.finditer(rf"(?<![A-Za-z]){d}(?![a-z])", t))
        if not mm:
            fail(f"{year}: division {d} absent from elected page")
        i_marks.append((d, mm[0].start()))
    i_marks.sort(key=lambda x: x[1])
    PTYVOC = ("Liberal Party", "Australian Labor Party", "Tasmanian Greens",
              "Independent", "Animal Justice Party", "Jacqui Lambie Network",
              "Shooters, Fishers, Farmers TAS", "The Nationals", "Local Network")
    out = {}
    pairs_re = re.compile(
        r"([A-Z][A-Z'’\-\.]*(?:\s+[A-Z][A-Z'’\-\.]+)*,\s*"
        r"[A-Z][a-z][a-zA-Z'’\.]*(?:\s+[A-Z][a-zA-Z'’\-\.]*)*)\s+"
        r"(" + "|".join(PTYVOC) + r")")
    for idx, (d, i0) in enumerate(i_marks):
        i1 = i_marks[idx + 1][1] if idx + 1 < len(i_marks) else len(t)
        seg = t[i0:i1]
        rows = []
        for mm in pairs_re.finditer(seg):
            nm = clean_txt(mm.group(1))
            pty = mm.group(2)
            if nm.lower().startswith(("to be", "media", "back to", "learn")):
                continue
            tag = tag_of(pty)
            rows.append({"n": nm, "pty": tag, "tag": tag})
        out[d] = rows
    for d in want:
        if not out.get(d):
            fail(f"{year}: elected page yields no names for {d}")
    return out


def enrolled_era(year, div):
    """tas21-era division pages print 'Enrolment: 78,182'; the two newer
    pages '80,126 electors' — one shared regex."""
    h = read_file(year, f"results-{div.lower()}.html")
    t = plain(h)
    m = re.search(r"Enrolment:\s*([\d,]+)", t)
    if m:
        return bn_int(m.group(1))
    m = re.search(r"([\d,]{3,})\s*electors", t)
    if m:
        return bn_int(m.group(1))
    m = re.search(r"Enrolment\s*</?[a-zA-Z ]{0,12}>\s*([\d,]+)", read_file(year, f"results-{div.lower()}.html"))
    if m:
        return bn_int(m.group(1))
    return None


# ============================================================ fppp workbooks
def read_fppp(year, div):
    """Modern-era per-venue workbook. Rows as candidates, a totals row on
    the boundary after each ballot-column group:
      "SURNAME, Given", "…", "Tasmanian Greens", "Group B", "Jacqui Lambie
      Network", …, plus tail rows Total-Formal / Informal / Total.
    Returns {"venues": [...], "cands": [{n, cells, votes}], "party_total_rows":
    {partyprint: [cell ...]}, "group_rows": {...}, "tail": {...}}.
    """
    import openpyxl
    if year == "2018":
        p = os.path.join(SFS, year, f"fppp-{div.lower()}.xlsx")
    else:
        p = os.path.join(SFS, year, "fp-by-polling-places.xlsx")
    if not os.path.exists(p):
        fail(f"workbook missing: {p}")
    wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
    if year == "2018":
        sheet_name = wb.sheetnames[0]
    else:
        sheet_name = div
    if sheet_name not in wb.sheetnames:
        if year == "2018" and len(wb.sheetnames) == 1:
            pass
        else:
            fail(f"{year}/{div}: workbook sheets {wb.sheetnames} no match")
    ws = wb[sheet_name]
    rows = [[("" if c is None else c) for c in r] for r in ws.iter_rows(values_only=True)]
    if len(rows) < 4:
        fail(f"{year}/{div}: thin worksheet")
    banner = [str(c or "").strip() for c in rows[1]]
    if banner[0].lower() != "candidates":
        fail(f"{year}/{div}: venue banner row drifted ({banner[:3]})")
    banner_all = [str(c or "").strip() for c in banner[1:]]
    while banner_all and banner_all[-1] in ("", "None"):
        banner_all.pop()
    # two composite columns ride the banner riding medieval-style totals:
    # "Total Ordinary Votes" inside and "Total" last. Both are summaries,
    # never venue columns; their positions are saved for per-row totals.
    idx_total = next((i for i, nm in enumerate(banner_all) if nm.lower() == "total"), None)
    idx_tot_ord = next((i for i, nm in enumerate(banner_all) if "total ordinal" in nm.lower() or
                       "total ordinary" in nm.lower()), None)
    if idx_total is None:
        fail(f"{year}/{div}: no final Total column ({banner_all[:3]}…{banner_all[-3:]})")
    total_col_pos = idx_total + 1  # 1-based spreadsheet cell index of the final Total
    keep = {i for i in range(len(banner_all))}
    keep.discard(idx_tot_ord) if idx_tot_ord is not None else None
    keep.discard(idx_total)
    venues = [banner_all[i] for i in sorted(keep) if banner_all[i]]
    if not venues:
        fail(f"{year}/{div}: empty venue banner once the summarising columns went")

    def cells_of(r):
        out = []
        for i in sorted(keep):
            c = r[1 + i] if 1 + i < len(r) else 0
            if c in ("", None):
                out.append(0)
                continue
            try:
                out.append(int(c))
            except (TypeError, ValueError):
                fail(f"{year}/{div}: non-integer vote cell {c!r}")
        out += [0] * (len(venues) - len(out))
        return out[:len(venues)]

    def total_of(r):
        c = r[total_col_pos] if total_col_pos < len(r) else None
        if c in ("", None):
            return sum(r[1:]) if False else 0
        try:
            return int(c)
        except (TypeError, ValueError):
            fail(f"{year}/{div}: Total cell not an integer ({c!r})")

    PARTY_FILE_SET = {nk(p) for p, _ in PARTY_TAGS}
    PARTY_FILE_SET |= {nk(x) for x in ("T4T-Tasmanians 4 Tasmania", "T4T",)}
    PARTY_FILE_SET |= {nk(x) for x in ("Shooters, Fishers, Farmers", "Palmer United Party",
                                       "National Party", "Animal Justice",
                                       "Independent", "Independents", "Others")}
    GROW = re.compile(r"^(Group\s+[A-Z]|ungrouped)$", re.I)

    def assign_pty(run_start, run_end, label, tag):
        for i in range(run_start, run_end):
            cands[i]["pty"] = tag
            if label and label.startswith("Group"):
                cands[i]["in_group"] = label

    cands, party_rows, group_rows, tail, run = [], {}, {}, {}, 0
    for r in rows[2:]:
        lab = str(r[0] or "").strip()
        if not lab:
            continue
        Lk = nk(lab)
        if Lk.startswith("TOTALFORMAL") or lab in ("Total Formal Votes", "Total Formal Ballot Papers"):
            tail.setdefault("formal_div", total_of(r))
            tail["formal"] = cells_of(r)
            continue
        if Lk.startswith("INFORMAL"):
            tail.setdefault("informal_div", total_of(r))
            tail["informal"] = cells_of(r)
            continue
        if Lk.startswith("TOTALBALLOT"):
            tail.setdefault("total", cells_of(r))
            continue
        mgrow = GROW.match(lab)
        if mgrow:
            group_rows[lab] = {"cells": cells_of(r), "total": total_of(r)}
            assign_pty(run, len(cands), lab, "UNGRP")
            run = len(cands)
            continue
        if Lk in PARTY_FILE_SET:
            party_rows[lab] = {"cells": cells_of(r), "total": total_of(r)}
            assign_pty(run, len(cands), lab, tag_of(lab))
            run = len(cands)
            continue
        nm = clean_txt(lab)
        if not re.match(r"^[A-Z]", nm):
            continue
        if nm.lower() in ("total", "percentage", "candidates"):
            continue
        cands.append({"n": nm, "cells": cells_of(r), "votes": total_of(r), "pty": None})
    assign_pty(run, len(cands), None, "TAG?UNASSIGNED")
    if not cands:
        fail(f"{year}/{div}: zero candidate rows parsed from workbook")
    unassigned = [c["n"] for c in cands if not c.get("pty")]
    if unassigned:
        fail(f"{year}/{div}: candidates without an owning group row: {unassigned[:6]}")
    return {"venues": venues, "cands": cands, "party_rows": party_rows,
            "group_rows": group_rows, "tail": tail}


# ============================================================== tas14/10 era
TAS14_PARTY_WORDS = [
    ("NATIONAL PARTY", "NP"), ("AUSTRALIAN LABOR PARTY", "ALP"),
    ("LIBERAL PARTY", "LIB"), ("AUSTRALIAN CHRISTIANS", "CHRIST"),
    ("TASMANIAN GREENS", "GRN"), ("PALMER UNITED PARTY", "PUP"),
    ("UNGROUPED", "UNGRP"),
]


def read_tas14_candidates_page(year, div):
    """The <Div>_Candidates.html card. Its own print splits the deck
    into party sections with a heading line inside
    <!-- begin a party--> … <h3 class="text-left">PNAME</h3> … <!-- the
    end -->, and per-candidate rows inside
    <!-- begin one candidate--><div class="row">…<p>NAME, Given</p>…
    <!-- end one candidate-->. This parses both blocks faithfully."""
    fname = f"candidates-{div.lower()}.html"
    h = read_file(year, fname)
    out = []
    # party sections via the h3 headings' literal text
    party_heads = [(m.start(), clean_txt(h[m.end():h.find("</h3>", m.end())]))
                   for m in re.finditer(re.escape('h3 class="text-left">'), h)]
    cands = []
    for m in re.finditer(re.escape("<!-- begin one candidate-->"), h):
        # the end marker reads `<!--end one candidate-->` verbatim
        j = h.find("<!--end one candidate-->", m.end())
        if j < 0:
            continue
        snippet = h[m.end():j]
        pm = re.search(r"<p>([^<]{2,60})</p>", snippet)
        if not pm:
            continue
        nm_part = clean_txt(_html.unescape(pm.group(1)))
        if not nm_part or "," not in nm_part or len(nm_part) > 46:
            continue
        sur, given = nm_part.split(",")[:2]
        nm = f"{clean_txt(sur)}, {clean_txt(given)}"
        pty = None
        for pos, pname in party_heads:
            if pos < m.start():
                pty = pname
        cands.append({"n": nm, "pty": tag_of(pty) if pty else "UNGRP"})
    seen, out = set(), []
    for c in cands:
        if c["n"] in seen:
            continue
        seen.add(c["n"])
        out.append(c)
    if not out:
        fail(f"{year}/{div}: no candidates read on the ballot card")
    return out


def read_tas14_year_standings(year, div):
    """tas14-era ppfp-<div>.pdf candidate+party totals (row-major engine);
    tas10's pollingfigures-<div>.pdf is the same engine. Candidate votes
    are per-row sums (cell identity rides separately for venue work later).
    """
    fname = (f"ppfp-{div.lower()}.pdf" if year == "2014"
             else f"pollingfigures-{div.lower()}.pdf")
    return parse_venue_family_pdf(year, fname)


SCR_ELECTED_RE = re.compile(
    r"([A-Z][A-Z''’\-]*(?: [A-Z][A-Z''’\-]*)*)(?:\s*,\s*(?:[A-Z](?:\.[A-Z]?)?\.?|"
    r"\([A-Za-z .]+\)))?\s+elected\s+(\d+)\b", re.I)


def tas14_scrutiny_elected(year, div):
    """tas14's scrutiny-event-sheet PDF tail: "<SURNAME> elected N" register
    — the commission prints pairs like 'BACON elected 1, GROOM elected 2'."""
    txt = pdf_text(year, f"scrutiny-{div.lower()}.pdf")
    out = []
    for m in SCR_ELECTED_RE.finditer(txt):
        sur, rank = clean_txt(m.group(1)), int(m.group(2))
        if not sur or len(sur) > 44 or sur.upper() in ("BACK", "FULLY"):
            continue
        key = (sur.upper(), rank)
        if key not in [(x["sur"], x["rank"]) for x in out]:
            out.append({"sur": sur.upper(), "rank": rank})
    if len(out) < 5:
        fail(f"{year}/{div}: scrutiny sheet carries only {len(out)} elected marks")
    out.sort(key=lambda c: c["rank"])
    return out


# ------------------------------------------------------- tas18/14/21 target
def read_tas14_elected():
    """tas14's results-index = the commission's 'Summary of Elected
    Members', names as 'SURNAME, Given <PartyName>' per division block."""
    t = plain(read_file("2014", "results-index.html"))
    anchor = t.find("Summary of Elected Members")
    if anchor < 0:
        fail("tas14 results-index: elected-members anchor missing")
    body = t[anchor + len("Summary of Elected Members"):]
    names = ["Bass", "Braddon", "Denison", "Franklin", "Lyons"]
    hops = []
    for nm in names:
        mm = re.search(rf"(?<![A-Za-z]){re.escape(nm)}(?![a-z])", body)
        if mm is None:
            fail(f"tas14 results-index: {nm} block start missing")
        hops.append((nm, mm.start()))
    hops.sort(key=lambda cx: cx[1])
    out = {}
    SUR_TOK = r"[A-Z][A-Za-z''’\-]+"
    ROW_RE = re.compile(
        r"(" + SUR_TOK + r"(?:\s+" + SUR_TOK + r")*),\s*([A-Z][a-z][a-zA-Z'’\-]*(?:\s+[A-Z][a-zA-Z'’\-]+)*)\s+"
        r"(Liberal Party|Australian Labor Party|Tasmanian Greens|"
        r"Palmer United Party|National Party)")
    for ix, (nm, i0) in enumerate(hops):
        end = hops[ix + 1][1] if ix + 1 < len(hops) else len(body)
        seg = body[i0 + len(nm):end]
        rows = ROW_RE.findall(seg)
        block = []
        for sur, given, pty in rows:
            n_txt = f"{clean_txt(sur)}, {clean_txt(given)}"
            block.append({"n": n_txt, "pty": tag_of(pty), "rank": len(block) + 1})
        if len(block) != 5:
            fail(f"tas14 results-index: {nm} roster of {len(block)} (want 5)")
        out[nm] = block
    return out


# ---------------------------------------------------------------- tas10 era
def read_tas10_elected():
    """TEC hub-electionsummary.html — five rank rows of five divisions;
    cells print in a flat token stream name... party name... party:
      "1 Ferguson Liberal Green ALP O'Connor Tas. Greens Hodgman Liberal
       Morris Tas. Greens 2 O'Byrne M ALP ..."
    A rank-anchor lands per '[1-5]'; token-walk reads name tokens until the
    next party token ('Liberal', 'A.L.P.', 'ALP' or the two-token
    'Tas. Greens'); each cell belongs to that rank's column position."""
    t = plain(read_file("2010", "hub-electionsummary.html"))
    i = t.find("BASS")
    if i < 0:
        fail("tas10: hub summary lacks the BASS key")
    m = re.search(r"BASS\s+BRADDON\s+DENISON\s+FRANKLIN\s+LYONS\s+(.+?)\s+(?:Back\s+to\s+2010|Back\s+to\s+2010|$)",
                  t[i:] + " Back to 2010", re.S)
    if not m:
        fail("tas10: summary matrix anchor drifted")
    body = m.group(1)
    order = ["Bass", "Braddon", "Denison", "Franklin", "Lyons"]
    TAGS = {"Liberal": "LIB", "ALP": "ALP", "A.L.P.": "ALP", "Tas. Greens": "GRN"}

    def tokens_of(seg):
        for top in re.split(r"\s+", seg):
            if top:
                yield top

    out = {}
    # walk rank anchors
    parts = re.split(r"\s+(?=^[1-5]\s|$)|(?=^[1-5]\s)", "\n".join(body.split("\n")))
    flat = " ".join(body.split())
    # split on rank-anchors: token preceding looks like a lone digit 1-5
    toks = list(tokens_of(flat))
    cells = []
    i2 = 0
    rank = None
    while i2 < len(toks):
        tk = toks[i2]
        if rank is None and re.match(r"^[1-5]$", tk):
            rank = int(tk)
            i2 += 1
            continue
        if rank is not None:
            name = []
            while i2 < len(toks):
                tk = toks[i2]
                if tk in ("Tas.",):
                    pty = f"Tas. {toks[i2+1]}"
                    i2 += 2
                    cells.append((rank, " ".join(name), pty))
                    rank += 1
                    break
                if tk in TAGS:
                    pty = tk
                    i2 += 1
                    cells.append((rank, " ".join(name), pty))
                    rank += 1
                    break
                if re.match(r"^[1-5]$", tk) and ":" not in tk and len(tk) == 1:
                    if len(toks) > i2 + 1:
                        nrank = int(tk)
                        rank = nrank
                        name = []
                        i2 += 1
                        continue
                if len(tk) >= 1 and tk[0].isupper() and len(name) < 4:
                    name.append(tk)
                    i2 += 1
                    continue
                i2 += 1
                break
    if rank is None or len(cells) == 0:
        fail(f"tas10: summary matrix token-walk starved ({len(cells)} cells)")
    for ci, (rk, nm_txt, pty) in enumerate(cells):
        d = order[ci % 5]
        rr = ci // 5 + 1
        nm = clean_txt(nm_txt)
        ptag = TAGS[pty]
        out.setdefault(d, []).append({"n": nm, "pty": ptag, "rank": rr})
    for d in order:
        if len(out.get(d, [])) != 5:
            fail(f"tas10: {d} roster of {len(out.get(d, []))} (want 5)")
    for d in order:
        out[d].sort(key=lambda c: c["rank"])
    return out


# ================================================================= the union
def load_frame(frame):
    """The end-state per-frame assembly. Era-selects:
      tas10: candidate+votes=psephos-tas2010; elected=hub-matrix; enrolled
             via psephos division rows; pty tags from psephos party blocks;
             informal via psephos division informal numbers
      tas14: candidate+votes=ppfp-<div>.pdf per-candidate grand columns;
             pty=candidates-page ballot card; elected=results-index's
             'Summary of Elected Members'; enrolled per division = None
             (none exists anywhere in 2014-era TEC print — sa18-lane
             convention), enrolled statewide from psephos tas2014's state
             block (upstream truncated artifact's one complete row)
      tas18: fppp state-era shift — the candidates in BOTH the frame's
             lens set (pty boundary-label-assigned there) and its tail;
             elected = the results pages' sitting-dot Elected markers;
             enrolled/informal per division via psephos tas2018 rows
      tas21: fppp statewide workbook; elected=candidates-elected.html;
             enrolled='Enrolment:' on the division pages
      tas24: fppp statewide; elected=candidates-elected.html;
             enrolled/'N electors' div pages; members era flips five→seven
      tas25: fppp statewide + elected page; enrolled/'N electors' div pages
             (no psephos edition exists for 2025 — first-party-only ladder)
    Returns {"cfg", "divsjects": {div: {…}}} — one shaped-framer construct.
    """
    cfg = FRAMES[frame]
    yr = cfg["day"][:4]
    members_of = cfg["members"]
    cands, elected, enrolled, informal, formal, venues = {}, {}, {}, {}, {}, {}
    out_divs = {}
    if frame == "tas10":
        pseph = read_psephos(yr)
        els = read_tas10_elected()
        for dv in cfg["divs"]:
            pv = next(x for x in pseph["divs"] if x["n"] == dv)
            cands[dv] = [{"n": c["n"], "pty": c["pty"], "votes": c["votes"]}
                         for c in pv["cands"]]
            formal[dv] = pv["formal"]
            informal[dv] = pv["informal"]
            enrolled[dv] = pv["enrolled"]
            elected[dv] = els[dv]
        out_divs = {"allas-both": None}
    if frame == "tas14":
        pseph_state = read_psephos(yr)["state"]
        for dv in cfg["divs"]:
            cards = read_tas14_candidates_page(yr, dv)
            pdf = read_tas14_year_standings(yr, dv)
            cand_txt = {c["n"].replace(", ", " ").upper(): c for c in cards}
            votes = {nm_of(c["n"]).upper(): c["votes"] for c in pdf["cands"]}
            built = []
            # votes follow the ppfp per-candidate grand columns; ballot
            # card carries the exact name/pty pair — supplementary ppfp
            # rows match by cleaned-name appending
            for c in pdf["cands"]:
                k = nm_of(c["n"]).replace(", ", " ").upper()
                card = cand_txt.get(k)
                built.append({"n": c["n"], "pty": (card["pty"] if card else c.get("pty") or "UNGRP"),
                              "votes": c["votes"]})
            cands[dv] = built
            formal[dv] = pdf["tail"].get("formal_div")
            informal[dv] = pdf["tail"].get("informal_div")
            enrolled[dv] = None
        elected = read_tas14_elected()
        out_divs = {"outer-state": pseph_state} if False else None
    if frame == "tas18":
        pseph = read_psephos(yr)
        for dv in cfg["divs"]:
            f = read_fppp(yr, dv)
            pv = next(x for x in pseph["divs"] if x["n"] == dv)
            cand_text = {c["n"]: c for c in f["cands"]}
            by = {}
            built = []
            for c in f["cands"]:
                built.append({"n": c["n"], "pty": c["pty"], "votes": c["votes"]})
            cands[dv] = built
            formal[dv] = f["tail"].get("formal_div")
            informal[dv] = f["tail"].get("informal_div")
            enrolled[dv] = pv["enrolled"]
            venues[dv] = f["venues"]
        elected = {
            d: [c for c in read_tas18_results(yr, d)["cands"] if c.get("elected")]
            for d in cfg["divs"]
        }
    if frame in ("tas21", "tas24", "tas25"):
        els = elected_roster_21_24_25(yr)
        for dv in cfg["divs"]:
            f = read_fppp(yr, dv)
            cands[dv] = [{"n": c["n"], "pty": c["pty"], "votes": c["votes"]}
                         for c in f["cands"]]
            formal[dv] = f["tail"].get("formal_div")
            informal[dv] = f["tail"].get("informal_div")
            enrolled[dv] = enrolled_era(yr, dv)
            venues[dv] = f["venues"]
            elected[dv] = els.get(dv, [])
    return {"frame": frame, "cfg": cfg, "year": yr,
            "cands": cands, "elected": elected,
            "formal": formal, "informal": informal,
            "enrolled": enrolled, "venues": venues}


def nm_of(s):
    return " ".join(str(s or "").replace(",", "").upper().split())


def load(frame):
    if frame not in FRAMES:
        fail(f"tas frame {frame} unknown")
    cfg = FRAMES[frame]
    return {"frame": frame, "cfg": cfg, "year": cfg["day"][:4]}
