"""The sa22 frame's House of Assembly seating plan (map/data/house-seating-plan-sa-2024-12-28.json).

The Parliament of South Australia's chamber maps (chamber-maps.parliament.sa.gov.au,
a "staffmap" floor-plan app, project psa1) hold who sits in which desk in each
chamber. The House of Assembly floor (id 2020111280982479) is drawn on the image
"HOA Chamber Map Final - v2.png" (1100x981, displayed at 1375x1226 CSS px); every
desk is a positioned panel (desk code A1..T1, ~62 desks) and every member an
"employeepanel" carrying surname + electorate, bound to a desk. The staffmap
records are keyed by creation timestamp, which dates the filing of the current
term's plan to 25 March/1 April 2022 — the desks below are the ones the 47th
Parliament sat at, except where members changed mid-term.

The Wayback Machine captured the live floor (the AjaxAction.aspx getfloorwindows
response) only twice: the Legislative Council floor 25 Sep 2024 and the House of
Assembly floor 28 Dec 2024 (its own page captures, including the crawler's of
2022-10-20, hold only the app shell — the floor content arrives by POST, which no
crawl before Sep 2024 recorded). This script reads the committed capture
.build/map/src/sa-hoa-2024-12-28/ajaxaction-20241228133435.json (with the floor
artwork hoa-chamber-map-final-v2.png) and writes:

  map/data/house-seating-plan-sa-2024-12-28.json   the plan, in the federal files' shape
  map/data/house-seating-plan-sa-2024-12-28.md     its provenance notes

Between election day (19 Mar 2022) and the capture (28 Dec 2024) four members'
places changed, and the plan records their successors' desks:
  - Bragg:  Vickie Chapman (LIB) resigned 4 May 2022; Jack Batty (LIB) won the
            21 May 2022 by-election. His employee record was filed 11 Jul 2022.
  - Dunstan: Steven Marshall (LIB) resigned Feb 2024; Cressida O'Hanlon (ALP)
            won the 23 Mar 2024 by-election (record filed 3 Apr 2024).
  - Black:  David Speirs (LIB) resigned 15 Oct 2024; Alex Dighton (ALP) won the
            16 Nov 2024 by-election (record filed 24 Nov 2024).
  - Speaker: Dan Cregan (Kavel, IND), elected Speaker 13 Oct 2021, stood down
            11 Apr 2024 to join the ministry; Leon Bignell (Mawson, ALP) took the
            chair. The plan's chair (desk T1) therefore holds Bignell, and Cregan
            sits at desk C1. seating.mjs's LATER_SPEAKER entry keeps the
            election-night Speaker in the chair on the sa22 view, exactly as its
            2010 federal entry kept Harry Jenkins there over Slipper's plan.

Coordinate frame: the desk panels' CSS top/left (px of the 1375x1226 floor) is
shifted so the printed "Speaker" label sits at the origin (the federal plans'
own convention: government at negative x, the chamber running downward); each
desk's printed ~26 px chair glyph centres it at (+13, +13). What lands in the
json is each label's north-west corner exactly as the federal files store it,
i.e. centred MINUS the 2.1pt/char + 8pt offsets seating.mjs adds back when it
fits labels to seats.

usage: python3 -I .build/map/build_sa22_seating.py
"""
import json, os, re

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(REPO, ".build", "map", "src", "sa-hoa-2024-12-28")
DATA = os.path.join(REPO, "map", "data")
DATE = "sa-2024-12-28"
CAPTURE_TS = "20241228133435"
CAPTURE_DAY = "28 December 2024"

# the printed "Speaker" label's centre in floor px (OCR of the archived artwork):
# the origin of every coordinate below
X0, Y0 = 894.0, 120.0
DESK = 13.0  # half a desk glyph

FILED = DATE  # the file key is the capture date — the only archived version of this floor

# members returned after the 19 March 2022 count the sa22 view shows (their desks
# are in the plan; the view itself draws the election-night members)
BYELECTION = {
    "Bragg":   ("Jack Batty", "LIB", "won the 21 May 2022 by-election after Vickie Chapman (LIB) resigned 4 May 2022"),
    "Dunstan": ("Cressida O'Hanlon", "ALP", "won the 23 March 2024 by-election after Steven Marshall (LIB) resigned"),
    "Black":   ("Alex Dighton", "ALP", "won the 16 November 2024 by-election after David Speirs (LIB) resigned"),
}

# the chair holds Bignell at the capture (Cregan stood down 11 April 2024);
# on the sa22 view the chamber shows the election-night Speaker (Cregan) in the
# chair instead — .build/map/seating.mjs LATER_SPEAKER.sa22
CHAIR_DIV = "Mawson"  # desk T1, tagged side "speaker" below


def main():
    raw = json.load(open(os.path.join(SRC, f"ajaxaction-{CAPTURE_TS}.json")))
    html = raw[1]["value"]
    assert f"spanPanels_2020111280982479" in html, "the capture is not the House of Assembly floor"

    # desks: panel id -> { desk, top, left, assigned }
    desks = {}
    for m in re.finditer(r"<div id ='(\d+)' name ='([^']*)' style='top:([\d.]+)px;left:([\d.]+)px;[^']*'[^>]*class=\"(deskpanel[^\"]*)\"", html):
        pid, name, top, left, cls = m.groups()
        desks[pid] = {"desk": name, "top": float(top), "left": float(left), "assigned": "deskassigned" in cls}

    # employee panels: empid, surname, electorate, desk it sits on
    emps = []
    for m in re.finditer(r'<div id ="(\d+)" style ="top:([\d.]+)px;left:([\d.]+)px;[^"]*" class="employeepanel[^"]*" deskid="(\d+)"><img[^>]*/><span f=\'lastname\'[^>]*>([^<]*)</span>(?:\s*<span f=\'electorate\'[^>]*>([^<]*)</span>)?', html):
        empid, _top, _left, deskid, last, elec = m.groups()
        d = desks[deskid]
        emps.append({"emp": empid, "last": last, "elec": elec, "desk": d["desk"],
                     "x": d["left"] - X0 + DESK, "y": d["top"] - Y0 + DESK})
    assert len(emps) == 47, f"{len(emps)} members on the floor, expected 47"

    # election-night roster for full names and the view's parties
    res = json.load(open(os.path.join(DATA, "res-sa22.json")))
    won = {}
    for d in res["divs"]:
        w = next(c for c in d["c"] if c[6] == 1)
        won[d["n"]] = {"member": w[0], "party": {"alp": "ALP", "lnp": "LIB", "ind": "IND"}[w[3]]}
    for div, (member, party, _why) in BYELECTION.items():
        assert div in won, f"{div}: not a sa22 division"
        won[div] = {"member": member, "party": party}

    seen = set()
    rows = []  # letter -> seats
    for e in emps:
        div = e["elec"]
        assert div and div in won, f"{e}: electorate not a sa22 division"
        assert div not in seen, f"{div}: seated twice"
        seen.add(div)
        w = won[div]
        letter = re.match(r"[A-Z]+", e["desk"]).group(0)
        rows.append((letter, {"seat": e["desk"], "side": None,  # filled below
            "member": w["member"], "party": w["party"],
            "label": e["last"].replace(" OAM", ""), "division": div,
            "x": round(e["x"] - 2.1 * len(e["last"].replace(" OAM", "")), 1),
            "y": round(e["y"] - 8.0, 1)}))

    # sides: the printed Speaker's label is the origin; the government's column is
    # the left-hand one (x < 0), the opposition's the right — the floor's own
    # arrangement. The crossbench's three country members sit off the opposition
    # side's foot; the fourth (Cregan, a minister) sits in the government column.
    # side labels follow bloc membership like the federal files, not raw position.
    GOV, OPP, CROSS = "government", "opposition", "crossbench"
    for _letter, s in rows:
        if s["division"] == CHAIR_DIV:
            s["side"] = "speaker"  # desk T1 is the chair on this floor
            continue
        if s["party"] == "ALP":
            s["side"] = GOV
        elif s["party"] == "LIB":
            s["side"] = OPP
        else:
            s["side"] = CROSS

    # row groups: the floor's own desk letters, government column first then the
    # opposition's, each row's seats ordered from the Speaker end (small y)
    LETTER_GROUPS = [
        (1, ["A", "F"]), (2, ["B", "E"]), (3, ["K", "G", "I"]), (4, ["H", "J"]),
        (5, ["L", "Q"]), (6, ["M", "R"]), (7, ["C", "D"]), (8, ["N", "P", "O", "T"]),
    ]
    group_of = {g: r for r, letters in LETTER_GROUPS for g in letters}
    plan_rows = []
    for r, letters in LETTER_GROUPS:
        seats = [s for letter, s in rows if group_of[letter] == r]
        seats.sort(key=lambda s: (s["y"], s["x"]))
        plan_rows.append({"row": r, "seats": seats})
    assert sum(len(r["seats"]) for r in plan_rows) == 47

    counts = {}
    for _letter, s in rows:
        counts[s["party"]] = counts.get(s["party"], 0) + 1
    assert counts == {"ALP": 29, "LIB": 14, "IND": 4}, counts

    assert {s["seat"] for _l, s in rows} == {d["desk"] for d in desks.values() if d["assigned"]}, \
        "a desk's assignment doesn't match its member panel"

    meta = {
        "title": "Seating plan — House of Assembly chamber, 47th Parliament of South Australia",
        "planDate": "December 2024",
        "source": "chamber-maps.parliament.sa.gov.au (Parliament of South Australia's staffmap floor plan, project psa1, floor 2020111280982479 \u2014 'House of Assembly'), retrieved via the Internet Archive Wayback Machine capture of 2024-12-28 13:34:35 (web.archive.org/web/" + CAPTURE_TS + ") of its AjaxAction.aspx getfloorwindows response, the earliest preserved version of this floor; the floor artwork 'HOA Chamber Map Final - v2.png' from the same day's capture (web.archive.org/web/20241228133437)",
        "harvested": "2026-10-26",
        "method": "The captured floor-windows response lists every desk as a positioned panel (CSS top/left on the 1375\u00d71226 px floor) and every member as an 'employeepanel' (surname + electorate) bound to a desk; desks and members are paired one-to-one by desk id (47/47), then each division's member is verified against the 2022 election-night roster in map/data/res-sa22.json (44/47; Bragg, Dunstan and Black had changed hands at by-elections \u2014 each successor's member record is dated after its by-election, 2022-07-11, 2024-04-03, 2024-11-24). Employee records carry their creation date: the benches below were filed 25 March/1 April 2022, the current term's own seating, and were unchanged at the capture except as the by-elections and the Speaker's change forced. The Speaker label's printed centre (894, 120) is the coordinate origin.",
        "page": "The floor is drawn on 'HOA Chamber Map Final - v2.png' (1100\u00d7981, displayed at 1375\u00d71226 CSS px): the Speaker's chair at the top, the Clerk and Chairman of Committees below it, the government's column of desks down the middle-left, the opposition's down the right, the crossbench off the opposition's foot. Seat coordinates are the desk's centre in that shifted frame, y increasing downward.",
    }
    officials = {
        "speakerChair": {"label": "Speaker", "x": 0.0, "y": 0.0, "sits": "the Speaker in the chair above the table (desk T1 on the floor)"},
        "clerks": [
            {"label": "Clerk", "x": -80.0, "y": 116.0},
            {"label": "Chairman of Committees", "x": -18.5, "y": 114.0},
            {"label": "Deputy Clerk", "x": 92.0, "y": 114.0},
        ],
        "serjeantAtArms": {"label": "Serjeant-at-Arms", "x": 6.0, "y": 1080.0,
                           "note": "not printed on the floor artwork; placed at the foot of the chamber opposite the chair, beyond its lowest desk"},
    }
    out = {"meta": meta, "officials": officials, "rows": plan_rows, "counts": counts}
    p = os.path.join(DATA, f"house-seating-plan-{FILED}.json")
    with open(p, "w") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"house-seating-plan-{FILED}.json: 47 members in {len(plan_rows)} rows; counts {counts}")

    md = os.path.join(DATA, f"house-seating-plan-{FILED}.md")
    lines = [
        "# Seating plan — House of Assembly chamber, 47th Parliament of South Australia",
        "",
        f"From the Parliament of South Australia's interactive chamber map "
        f"([chamber-maps.parliament.sa.gov.au](https://chamber-maps.parliament.sa.gov.au/psa1/#floor_2020111280982479), "
        f"floor 2020111280982479 — 'House of Assembly'), as preserved by the Internet Archive on **{CAPTURE_DAY}** "
        f"(capture [20241228133435](https://web.archive.org/web/{CAPTURE_TS}/https://chamber-maps.parliament.sa.gov.au/_engine/AjaxAction.aspx) "
        f"of the floor's staffmap data feed; the [floor artwork](https://web.archive.org/web/20241228133437/https://chamber-maps.parliament.sa.gov.au/psa1/images/HOA%20Chamber%20Map%20Final%20-%20v2.png) "
        f"from the same crawl). Source files committed in `.build/map/src/sa-hoa-2024-12-28/`; machine-readable form "
        f"`house-seating-plan-{FILED}.json` (same folder), written by `.build/map/build_sa22_seating.py`.",
        "",
        "**Capture date.** The floor's seat assignments are served to the app live by an HTTP POST, which web crawlers "
        "do not record — the page's own captures (including the much-linked Wayback capture of 20 October 2022) hold only the "
        "app shell. The floor itself was crawled twice, late in the term: the Legislative Council floor on 25 September 2024 "
        "and this House of Assembly floor on **28 December 2024**. That capture is the only archived version of the floor, "
        "so it is the one filed here; it is not a plan printed soon after the 19 March 2022 election. Employee records on the "
        "floor are stamped with their creation date, and every desk whose occupant never changed still carries the record "
        "filed on 25 March/1 April 2022 — the benches the new parliament took at its first sittings.",
        "",
        "**Changes between election day and the capture**, all dated by the floor's own records:",
    ]
    for div in ["Bragg", "Dunstan", "Black"]:
        member, party, why = BYELECTION[div]
        lines.append(f"- **{div}** — {member} ({party}) now sits at the desk: {why}.")
    lines += [
        "- **Speaker** — Dan Cregan (Kavel, IND), elected Speaker on 13 October 2021 and re-elected when the new parliament "
        "first sat in May 2022, stood down on 11 April 2024 to join the ministry. Leon Bignell (Mawson, ALP) took the chair, "
        "and the plan shows him there (desk T1); Cregan sits at desk C1. On this repo's sa22 view, which shows the "
        "election-night members, Cregan appears in the chair and Bignell in a government-side seat near it "
        "(seating.mjs LATER_SPEAKER, the 2010 Slipper precedent); desk C1 is left empty.",
        "",
        "The sa22 view as filed therefore shows 44 of 47 members at the desks they took in April 2022, Bragg/Dunstan/Black "
        "at their successors' desks (Dunstan and Black's successors — both Labor gains — sit in the government column, "
        "so those two divisions appear there rather than on their party's side), Bignell moved from the chair to a "
        "government-side seat, and C1 empty.",
        "",
        "**Orientation.** The chamber is drawn with the Speaker's chair at the top (the printed label centred at (894, 120) "
        "of the 1375\u00d71226 floor — the origin of the json's coordinates), the Clerk and Chairman of Committees below it, "
        "then two columns of desks running down the page: the government's (Labor) down the middle-left, the opposition's "
        "(Liberal) down the right, the crossbench's country members off the opposition's foot, and desk T1 — the Speaker's "
        "own — at the head. Desks are lettered in rows A–T.",
        "",
        "**Seat order below:** the floor's own desk letters grouped in rows 1–8 from the Speaker end, each row's seats "
        "ordered from the Speaker end (the printed rows, left column first). Parties are as at the capture.",
        "",
    ]
    for prow in plan_rows:
        lines.append(f"## Row {prow['row']}")
        lines.append("")
        for s in prow["seats"]:
            side = {"speaker": " *(chair — the Speaker)*", "government": "", "opposition": "", "crossbench": " *(crossbench)*"}[s["side"]]
            lines.append(f"{prow['row']}.{prow['seats'].index(s)+1} **{s['member']}** ({s['division']}, {s['party']}) — desk {s['seat']}{side}")
        lines.append("")
    counts_txt = ", ".join(f"{k} {v}" for k, v in counts.items())
    lines.append(f"**Counts at the capture:** {counts_txt} (47). Labor won 27 seats at the election and gained Dunstan and "
                 f"Black at by-elections; the Liberals won 16 and hold 14 at the capture; the four independents are unchanged.")
    lines.append("")
    with open(md, "w") as f:
        f.write("\n".join(lines))
    print(os.path.basename(md), "written")


main()
