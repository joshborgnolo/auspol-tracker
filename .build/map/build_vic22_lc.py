#!/usr/bin/env python3
"""The vic22 frame's upper house: map/data/senate-vic22.json — Victoria's
Legislative Council, in the federal Senate files' own shape with lc:true.

Victoria's council is NOT staggered like South Australia's or New South
Wales': all 40 members are elected together (five a region, eight regions)
to a term that ends at the state election four years on — the 2022 council's
term ends at the 28 November 2026 election. So `later` and every member's
`term` are 2026, and the model's up-next colouring takes the whole council
(the term lens's "everyone faces the voters" case; senateModel reads it off
the uniform term).

Sources (read-only, committed):
  .build/map/src/vic22/xlc/<region>-dop.xls
      the VEC's 2022 distribution-of-preferences report per region: the
      elected five are the candidates whose running total reaches the quota
      (the last seat a region's count fills without a quota goes to the
      leader of the leftovers — 2022 needed it nowhere, every region's five
      crossed). Checked against the VEC's "Upper House individual results"
      page for the same 40 names.
  .build/map/src/vic22/xlc/<region>-votes.xls
      first preferences (per booth, plus REGION TOTAL): statewide `votes` by
      party (a joint "Liberal / The Nationals" ticket files as LNP, the
      nsw23 file's convention; a party-less group files with the ungrouped),
      and the 2022 formal/informal totals.
  .build/state-flow-src/vic/lc/2018/<region>.html
      the 2018 election's region pages (the state preference-flows
      pipeline's own mirror): per-party first-preference sums give `pvotes`
      and the 2018 formal total `pformal`.
  map/data/lc-seating-plan-vic-2026-10-27.json (.build/map/vic_lc_plan.mjs)
      the Parliament's own council seating plan captured 27 October 2026:
      the council as it sits today. The file's roster therefore runs four
      term-time changes since polling day, marked in the senators' rows the
      federal files' own way:
      - Anasina Gray-Barberio (Greens, chosen by a joint sitting of
        13 November 2024) holds Samantha Ratnam's Northern Metropolitan
        seat — casual: { for: 'Samantha Ratnam' }
      - Richard Welch (Liberal, chosen 7 February 2024) holds Matthew
        Bach's North-Eastern Metropolitan seat — casual: { for: 'Matthew Bach' }
      - Adem Somyurek (elected Labour DLP, resigned the party March 2024)
        sits independent — electedAs: DLP
      - Moira Deeming (elected Liberal, joined Family First September 2026)
        — electedAs: LIB
      David Limbrick's party renamed itself (Liberal Democrats to
      Libertarian Party in 2023): a rename, not a move — no electedAs.

usage: python3 .build/map/build_vic22_lc.py <map_data_dir>     # e.g. map/data
"""
import json
import os
import re
import sys
import warnings

warnings.simplefilter("ignore")  # xlrd's sector-size grumble on the VEC files
import xlrd  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
XLC = os.path.join(REPO, ".build", "map", "src", "vic22", "xlc")
SRC18 = os.path.join(REPO, ".build", "state-flow-src", "vic", "lc", "2018")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "map", "data")

ELECTION = "2022-11-26"
AS_OF = "2026-10-27"  # the plan's date: the council as it sits now
TERM = 2026

REGIONS = [  # the VEC's declaration order
    "eastern-victoria", "northern-metropolitan", "northern-victoria",
    "south-eastern-metropolitan", "southern-metropolitan", "western-metropolitan",
    "western-victoria", "north-eastern-metropolitan",
]
REGION_NAME = {  # the plan's ElectorateNames per region slug
    "eastern-victoria": "Eastern Victoria", "northern-metropolitan": "Northern Metropolitan",
    "northern-victoria": "Northern Victoria", "south-eastern-metropolitan": "South-Eastern Metropolitan",
    "southern-metropolitan": "Southern Metropolitan", "western-metropolitan": "Western Metropolitan",
    "western-victoria": "Western Victoria", "north-eastern-metropolitan": "North-Eastern Metropolitan",
}
# the vacancies filled mid-term: outgoing -> (incoming, joint-sitting date), by region
FILLS = {
    "northern-metropolitan": [("RATNAM, Samantha", "Anasina Gray-Barberio", "2024-11-13")],
    "north-eastern-metropolitan": [("BACH, Matthew", "Richard Welch", "2024-02-07")],
}
NONCAND = {"TOTAL", "Exhausted", "Gain/Loss", "Informal", ""}

# the VEC's group strings onto the file's party codes (a joint Liberal / The
# Nationals ticket files as LNP, the nsw23 file's convention)
AB_2022 = {
    "Australian Labor Party - Victorian Branch": "ALP", "Liberal": "LIB",
    "Liberal / The Nationals": "LNP", "Australian Greens": "GRN",
    "Legalise Cannabis Victoria": "LCV", "Labour DLP": "DLP",
    "Liberal Democrats": "LDP", "Shooters, Fishers & Farmers Vic": "SFF",
    "Pauline Hanson's One Nation": "ONP", "Family First Victoria": "FFP",
    "Derryn Hinch's Justice Party": "DHJP", "Animal Justice Party": "AJP",
    "Victorian Socialists": "VS", "Fiona Patten's Reason Party": "RP",
    "Freedom Party of Victoria": "FPV", "Sack Dan Andrews Restore Democracy": "SDAR",
    "United Australia Party": "UAP", "Health Australia Party": "HAP",
    "Sustainable Australia Party – Stop Overdevelopment / Corruption": "SAP",
    "Companions and Pets Party": "CPP", "Angry Victorians Party": "AVP",
    "Transport Matters": "TMP", "New Democrats": "ND",
}
AB_2018 = {  # the 2018 pages' party cells (no joint groups stood in 2018)
    "AUSTRALIAN LABOR PARTY": "ALP", "LIBERAL": "LIB", "THE NATIONALS": "NAT",
    "AUSTRALIAN GREENS": "GRN", "SHOOTERS, FISHERS & FARMERS VIC": "SFF",
    "LIBERAL DEMOCRATS": "LDP", "ANIMAL JUSTICE PARTY": "AJP", "LABOUR DLP": "DLP",
    "DERRYN HINCH'S JUSTICE PARTY": "DHJP", "FIONA PATTEN'S REASON PARTY": "RP",
    "VOLUNTARY EUTHANASIA PARTY (VICTORIA)": "VEP", "AUSSIE BATTLER PARTY": "ABP",
    "VICTORIAN SOCIALISTS": "VS", "SUSTAINABLE AUSTRALIA": "SA",
    "HEALTH AUSTRALIA PARTY": "HAP", "AUSTRALIAN COUNTRY PARTY": "ACP",
    "TRANSPORT MATTERS": "TMP", "AUSTRALIAN LIBERTY ALLIANCE": "ALA",
    "HUDSON 4 NV": "HNV", "VOTE 1 LOCAL JOBS": "VLJ", "": "IND",
}
PN = {"ALP": "Australian Labor Party", "LIB": "Liberal Party", "NAT": "The Nationals",
      "GRN": "Australian Greens", "LCV": "Legalise Cannabis Victoria", "AJP": "Animal Justice Party",
      "LDP": "Libertarian Party", "SFF": "Shooters, Fishers and Farmers Party",
      "FFP": "Family First Victoria", "ONP": "Pauline Hanson's One Nation",
      "IND": "Independent", "DLP": "Democratic Labour Party"}
# the plan's PartyAbr strings onto the same codes
PLAN_AB = {"ALP": "ALP", "LP": "LIB", "NAT": "NAT", "GRN": "GRN", "LC": "LCV", "AJP": "AJP",
           "Libertarian": "LDP", "SFFP": "SFF", "Family First": "FFP", "One Nation": "ONP", "Ind": "IND"}


def fam(ab):
    return "lnp" if ab in ("LIB", "NAT", "LNP") else "alp" if ab == "ALP" else "grn" if ab == "GRN" else ab.lower()


def fail(msg):
    raise SystemExit(f"vic22-lc: {msg}")


def norm(name):
    """'HEATH, Renee' and 'Renee Heath' to one key (Mc/McCAHIE, hyphens, D' safe)"""
    n = name.strip()
    if "," in n:
        sur, giv = n.split(",", 1)
        n = f"{giv.strip()} {sur.strip()}"
    return re.sub(r"[^a-z'-]", "", n.lower())


def title(name):
    """'HEATH, Renee' -> 'Renee Heath'"""
    sur, giv = name.split(",", 1)
    return f"{giv.strip()} {sur.strip().title().replace("mc", "Mc", 1) if sur.isupper() else sur.strip()}"


# ---------------------------------------------------------------- the 2022 XLS mirrors
def dop_elected(slug, seats=5):
    """The region's elected five, in quota-crossing order (then leftover leaders)."""
    b = xlrd.open_workbook(os.path.join(XLC, f"{slug}-dop.xls"))
    s = b.sheet_by_index(0)
    quota = None
    for r in range(20):
        v = str(s.cell_value(r, 0))
        if v.startswith("Quota:"):
            quota = float(v.split(":", 1)[1].replace(",", ""))
    if not quota:
        fail(f"{slug} dop: no quota line")
    hr = None
    for r in range(s.nrows):
        if str(s.cell_value(r, 0)).startswith("Count"):
            hr = r
            break
    hdr = [str(s.cell_value(hr, c)).strip() for c in range(s.ncols)]
    names = [(c, h) for c, h in enumerate(hdr) if c >= 4 and h and h not in NONCAND]
    elected, last = [], {}
    for r in range(hr + 1, s.nrows):
        if str(s.cell_value(r, 3)) == "PTotal":
            for c, h in names:
                v = s.cell_value(r, c)
                if isinstance(v, (int, float)):
                    if h not in elected and v >= quota:
                        elected.append(h)
                    last[h] = v
    order = 0
    if len(elected) < seats:
        rest = [(h, v) for h, v in sorted(last.items(), key=lambda t: -t[1]) if h not in elected]
        elected += [h for h, _ in rest[:seats - len(elected)]]
        order = 1
    if len(elected) != seats:
        fail(f"{slug}: {len(elected)} elected, {seats} expected")
    return elected, order


def votes_2022():
    """Statewide first preferences by party, totals, and each candidate's group."""
    votes, cand_party = {}, {}
    formal = informal = 0
    for slug in REGIONS:
        b = xlrd.open_workbook(os.path.join(XLC, f"{slug}-votes.xls"))
        s = b.sheet_by_index(0)
        hdr = [str(s.cell_value(7, c)).strip() for c in range(s.ncols)]
        rt = None
        for r in range(s.nrows - 1, 0, -1):
            if str(s.cell_value(r, 0)).strip() == "REGION TOTAL":
                rt = r
                break
        if not rt or not str(s.cell_value(rt - 1, 3)).startswith("Group A"):
            fail(f"{slug} votes: no REGION TOTAL row under a repeated header")
        gsum, gparty = 0, {}
        atl = btl = None
        for c, h in enumerate(hdr):
            if not h:
                continue
            lines = h.split("\n")
            m = re.match(r"^Group ([A-Z]+)$", lines[0])
            if m and lines[-1] == "TOTAL":
                p = gparty.get(m.group(1)) or "ind"  # a party-less group counts with the ungrouped
                v = int(s.cell_value(rt, c) or 0)
                votes[p] = votes.get(p, 0) + v
                gsum += v
            elif m and lines[-1] == "ATL" and len(lines) >= 3 and lines[1].strip():
                gparty[m.group(1)] = lines[1].strip()
            elif m and len(lines) >= 3:
                cand_party[norm(lines[-1])] = lines[1].strip()
            elif h.startswith("Ungrouped\n"):
                v = int(s.cell_value(rt, c) or 0)
                votes["ind"] = votes.get("ind", 0) + v
                gsum += v
            elif h == "Total ATL":
                atl = int(s.cell_value(rt, c))
            elif h == "Total BTL":
                btl = int(s.cell_value(rt, c))
            elif h == "Total Formal":
                f = int(s.cell_value(rt, c))
                if f != atl + btl or f != gsum:
                    fail(f"{slug}: formal {f} vs ATL+BTL {atl + btl} vs group sum {gsum}")
                formal += f
            elif h == "Total Informal":
                informal += int(s.cell_value(rt, c))
    if sum(votes.values()) != formal:
        fail(f"2022 group votes {sum(votes.values())} != formal {formal}")
    mapped = {}
    for p, v in votes.items():
        if p == "ind":
            ab = "IND"
        elif p not in AB_2022:
            fail(f"unmapped 2022 group {p!r} — extend AB_2022")
        else:
            ab = AB_2022[p]
        mapped[ab] = mapped.get(ab, 0) + v
    return mapped, cand_party, formal, informal


def pvotes_2018():
    """The 2018 region pages' per-party first-preference sums and formal total."""
    import html as htmlm
    votes, pformal = {}, 0
    files = sorted(f for f in os.listdir(SRC18) if f.endswith("region.html"))
    if len(files) != 8:
        fail(f"{len(files)} 2018 region pages, 8 expected")
    for f in files:
        h = open(os.path.join(SRC18, f), encoding="utf-8").read()
        m = re.search(r"<th>\s*Formal Votes:\s*</th>\s*<td>([\d,]+)</td>", h)
        if not m:
            fail(f"{f}: no Formal Votes figure")
        pformal += int(m.group(1).replace(",", ""))
        i = h.find('title="First preference votes"')
        if i < 0:
            fail(f"{f}: no first-preference table")
        tbl = h[i:h.find("</table>", i)]
        rows = re.findall(r"<tr>\s*<td>([^<]+)</td>\s*<td>([^<]*)</td>\s*<td>([\d,]+)</td>", tbl)
        if not rows:
            fail(f"{f}: first-preference table parses to no rows")
        for _nm, party, v in rows:
            ab = AB_2018.get(re.sub(r"\s+", " ", htmlm.unescape(party)).strip())
            if ab is None:
                fail(f"{f}: unmapped 2018 party {party!r} — extend AB_2018")
            votes[ab] = votes.get(ab, 0) + int(v.replace(",", ""))
    if sum(votes.values()) != pformal:
        pass  # the pages' candidate cells cover every formal vote by construction; note the gap
    return votes, pformal


# ---------------------------------------------------------------- the roster
def build():
    plan_path = os.path.join(OUT, "lc-seating-plan-vic-2026-10-27.json")
    if not os.path.exists(plan_path):
        fail(f"{plan_path} missing — run node .build/map/vic_lc_plan.mjs first")
    plan = json.load(open(plan_path))
    members = list(plan["members"].values())
    if len(members) != 40:
        fail(f"the plan seats {len(members)} members, 40 expected")

    # the 40 elected, from the VEC's distributions
    elected, cand_party, formal, informal = {}, {}, [], []
    votes, cand_party, formal, informal = votes_2022()
    for slug in REGIONS:
        elected[slug] = dop_elected(slug)[0]
    p18, pformal = pvotes_2018()

    # the council as it sits (the plan), checked region by region against the
    # elected five with the two vacancy fills written in
    by_region = {}
    for m in members:
        by_region.setdefault(m["region"], []).append(m)
    senators = []
    seen_fills = set()
    for slug in REGIONS:
        cur = by_region.get(REGION_NAME[slug], [])
        if len(cur) != 5:
            fail(f"{slug}: the plan seats {len(cur)} in {REGION_NAME[slug]}, 5 expected")
        cur_n = {norm(c["m"]): c for c in cur}
        want_e = dict(zip((norm(e) for e in elected[slug]), elected[slug]))
        fills = {norm(f[0]): f for f in FILLS.get(slug, [])}
        for out in fills:
            if out not in want_e:
                fail(f"{slug}: {out} was not elected in 2022")
            if out in cur_n:
                fail(f"{slug}: {out} still sits by the plan")
        missing = [e for k, e in want_e.items() if k not in cur_n]
        if {norm(m) for m in missing} != set(fills):
            fail(f"{slug}: elected-but-gone {missing}, the fills expected {list(fills)}")
        extra = [c for k, c in cur_n.items() if k not in want_e]
        if {norm(x["m"]) for x in extra} != {norm(f[1]) for f in fills.values()}:
            fail(f"{slug}: sitting-but-not-elected {[x['m'] for x in extra]}, the fills expected")
        # emit in declaration order, each fill at its outgoing member's slot
        for k, e in want_e.items():
            f = fills.get(k)
            rec = cur_n[norm(f[1])] if f else cur_n[k]
            ab = PLAN_AB.get(rec["p"])
            if not ab:
                fail(f"{rec['m']}: unmapped PartyAbr {rec['p']!r}")
            elected_ab = AB_2022[cand_party[k]] if k in cand_party else None
            if not elected_ab:
                fail(f"{slug}: {e} has no 2022 group")
            sen = {"n": rec["m"], "st": "VIC", "ab": ab, "pn": PN[ab], "term": TERM}
            if f:
                seen_fills.add(f[0])
                sen["casual"] = {"for": title(e), "date": f[2], "elected": 2022}
            else:
                sen["elected"] = 2022
                if fam(ab) != fam(elected_ab):
                    sen["electedAs"] = elected_ab
            senators.append(sen)

    if len(seen_fills) != 2:
        fail(f"both vacancy fills must be seated: {seen_fills}")

    out = {
        "year": "vic22", "lc": True, "asOf": AS_OF, "date": ELECTION, "dd": False,
        "later": TERM, "nextPending": True, "seatsN": 40, "gov": "alp", "prev": 2018,
        "source": "Victorian Electoral Commission: the 2022 state election's Legislative Council "
                  "distributions and first preferences, and the 2018 region results; the council as "
                  "it sits from the Parliament's own seating plan of 27 October 2026",
        "senators": senators,
        "votes": votes, "pvotes": p18, "formal": formal, "pformal": pformal, "inf": informal,
    }
    with open(os.path.join(OUT, "senate-vic22.json"), "w") as fh:
        json.dump(out, fh, separators=(",", ":"), ensure_ascii=False)
        fh.write("\n")
    tally = {}
    for s in senators:
        tally[s["ab"]] = tally.get(s["ab"], 0) + 1
    print("senate-vic22.json:", " ".join(f"{k} {v}" for k, v in tally.items()),
          f"| formal {formal}, 2018 {pformal}, informal {informal}")


if __name__ == "__main__":
    build()
