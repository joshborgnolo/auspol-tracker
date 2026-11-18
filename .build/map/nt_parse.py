#!/usr/bin/env python3
"""nt_parse.py — the nt16/nt20/nt24 /map/ frame parser: the NTEC results-page
mirror (+ 2012's psephos/official-summary trifecta) -> the emitter's district
model. The wa_eis.py discipline on the NT Electoral Commission's own pages.

Reads (all committed mirrors; nothing is fetched here):
  .build/state-flow-src/nt/<YYYY>/<division>.html    2016/2020/2024 division
      pages — "Distribution of preferences" / "Electorate summary"
      (Candidate | Party | Primary | TCP | %TCP; then Formal / Informal /
      Total counted / Enrolment rows) / "First preferences by voting
      centre" (2016-20 plain tables, 2024 the js-table-wrapper split) /
      "Two candidate preferred by voting centre" (absent on two-candidate
      seats — the "No two candidate preferred count for X" note covers
      them) / "Parties" (Abbreviation | Name -> the pn lane)
  .build/state-flow-src/nt/2012/psephos-nt2012.txt   2012 election (nt16's
      past lane): Adam Carr's verbatim transcription — per-division
      candidates, final count, enrolment/formal/informal. Division-level
      only (2012 booth rows were never published into the mirror).
  .build/state-flow-src/nt/2012/2012-official-summary.txt — NTEC's official
      post-election report (pdftotext extract; the participation-oracle
      cross-check every 2012 psephos figure is asserted against)
  .build/map/src/nt/pp-nt.json                       venue coordinates
      (harvest-nt-src.py case 3; missing rows just draw no dot)

The venue lane is REAL venues only: mobile-team rows, Absent, Declaration,
Postal and the 2016-era "Early (…)" catch-alls fold into the district
identities and never appear as dots — most of remote NT votes via mobile
teams, so remote seats draw few or no dots (documented behaviour, the
same contraction WA's pseudo rows take). Per-candidate identity is
asserted per division: Σ booth-lane votes + Σ pseudo votes == district
formal per candidate column AND districtwide, fail-loud.
"""
import html as _html
import json
import os
import re

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SFS = os.path.join(REPO, ".build", "state-flow-src", "nt")
SRCN = os.path.join(REPO, ".build", "map", "src", "nt")

FRAME_YEAR = {"nt16": 2016, "nt20": 2020, "nt24": 2024, "nt12": 2012}
YEAR_FRAME = {v: k for k, v in FRAME_YEAR.items()}

#: display rosters (mirror order is slug order; the emitters read
#: EXPECTED by frame from nt_geo which sorts this map's values)
ROSTERS = {
    2012: ["Arafura", "Araluen", "Arnhem", "Barkly", "Blain", "Braitling",
           "Brennan", "Casuarina", "Daly", "Drysdale", "Fannie Bay",
           "Fong Lim", "Goyder", "Greatorex", "Johnston", "Karama",
           "Katherine", "Namatjira", "Nelson", "Nhulunbuy", "Nightcliff",
           "Port Darwin", "Sanderson", "Stuart", "Wanguri"],
    2016: ["Arafura", "Araluen", "Arnhem", "Barkly", "Blain", "Braitling",
           "Brennan", "Casuarina", "Daly", "Drysdale", "Fannie Bay",
           "Fong Lim", "Goyder", "Johnston", "Karama", "Katherine",
           "Namatjira", "Nelson", "Nhulunbuy", "Nightcliff", "Port Darwin",
           "Sanderson", "Spillett", "Stuart", "Wanguri"],
    2020: ["Arafura", "Araluen", "Arnhem", "Barkly", "Blain", "Braitling",
           "Brennan", "Casuarina", "Daly", "Drysdale", "Fannie Bay",
           "Fong Lim", "Goyder", "Gwoja", "Johnston", "Karama", "Katherine",
           "Mulka", "Namatjira", "Nelson", "Nightcliff", "Port Darwin",
           "Sanderson", "Spillett", "Wanguri"],
}
ROSTERS[2024] = ROSTERS[2020]

SLUGS = {
    2016: ["arafura", "araluen", "arnhem", "barkly", "blain", "braitling",
           "brennan", "casuarina", "daly", "drysdale", "fannie-bay",
           "fong-lim", "goyder", "johnston", "karama", "katherine",
           "namatjira", "nelson", "nhulunbuy", "nightcliff", "port-darwin",
           "sanderson", "spillett", "stuart", "wanguri"],
    2020: ["arafura", "araluen", "arnhem", "barkly", "blain", "braitling",
           "brennan", "casuarina", "daly", "drysdale", "fannie-bay",
           "fong-lim", "goyder", "gwoja", "johnston", "karama", "katherine",
           "mulka", "namatjira", "nelson", "nightcliff", "port-darwin",
           "sanderson", "spillett", "wanguri"],
}
SLUGS[2024] = SLUGS[2020]
#: filename slug -> display name fixups the slugger can't see
SLUG_DISPLAY = {"fong-lim": "Fong Lim"}

#: party abbreviation -> fam bucket (the app's closed FAM set lands CLP on
#: lnp; the merged NT Coalition partner never coexists with a NAT here —
#: parse-nt-state-flows.py's own comment). Territory Alliance, 1 Territory,
#: FNPP, ASP all buckets oth.
BUCKETS = {"ALP": "alp", "CLP": "lnp", "GRN": "grn", "Greens": "grn",
           "IND": "ind", "Ind": "ind", "Independents": "ind",
           "TA": "oth", "1TP": "oth", "FNPP": "oth", "ASP": "oth",
           "ONP": "onp"}
#: 2012 psephos transcription typos vs the official summary — enrolled-roll
#: figures only, psephos overridden by the official PDF at parse time.
#: (verification lane: formal/informal agree in both sources; ONLY the
#: roll figure drifts. A drift outside this pinned list fails loudly.)
PSEPHOS_2012_ROLL_OVERRIDES = {"Sanderson": 5100}

#: adjudicated NTEC self-contradictions between a division's Electorate
#: summary TCP row and its Distribution-of-preferences final progressive —
#: the DOP prints the count as it stood mid-static while the summary lane
#: (the one the pipeline's per-centre identities prove against) got a late
#: recount bump. (year, slug) -> per-candidate vote delta, summary minus
#: DOP-final. The summary stays canonical; an UNPINNED drift fails loudly.
DOP_SUMMARY_DIVERGENCES = {
    # 2016 era — the era's DOP is a mid-static snapshot; the summary and the
    # per-centre TCP table agree (Σ centre rows proves summary) so the
    # summary lane stays canonical
    (2016, "barkly"): {0: -3},           # McADAM 1260 → 1257 (exhaust 219→222)
    (2016, "daly"): {1: -5, 6: 9},       # VENES 1622→1617, HIGGINS 1763→1772 (exh 345→341)
    (2016, "drysdale"): {4: 7},          # CLP 1964 → 1971
    (2016, "namatjira"): {1: -1},        # ALP 1236 → 1235
    # 2020 era — same disease; gwoja's ±31 is a declared-recheck reallocation
    (2020, "arnhem"): {0: 4, 3: -4},
    (2020, "barkly"): {0: 1, 3: -1},
    (2020, "braitling"): {0: -2, 2: 2},
    (2020, "casuarina"): {2: -2, 3: 2},
    (2020, "drysdale"): {1: -2, 4: 2},
    (2020, "fannie-bay"): {2: 1, 4: -1},
    (2020, "gwoja"): {0: 31, 1: -31},
    (2020, "johnston"): {1: -1, 2: 1},
    (2020, "katherine"): {1: 8, 3: -8},
    (2020, "nelson"): {0: -1, 1: 1},
    (2020, "port-darwin"): {0: -8, 3: 8},
    # 2024 era — mostly clean; three ±1..±6 leftovers
    (2024, "drysdale"): {0: 1, 2: -1},
    (2024, "karama"): {1: -5, 3: -6},
    (2024, "port-darwin"): {4: 1},
}

#: long party names for eras whose pages carry no Parties table (2012) and
#: as the fallback for short codes their modern pages don't give
LONG_NAMES = {"ALP": "Australian Labor Party", "CLP": "Country Liberal Party",
              "GRN": "Australian Greens", "Greens": "Australian Greens",
              "IND": "Independent", "Ind": "Independent",
              "Independents": "Independents", "TA": "Territory Alliance",
              "1TP": "1 Territory Party", "FNPP": "First Nations Political Party",
              "ASP": "Australian Sex Party", "ONP": "One Nation"}

PSEUDO_VENUE_RE = re.compile(r"^(Absent|Declaration|Postal|Totals?|Percentage)$", re.I)
MOBILE_VENUE_RE = re.compile(r"^mobile team", re.I)
EARLY_OTHER_RE = re.compile(r"^early \(", re.I)
EVC_VENUE_RE = re.compile(r"\bEVC\b\s*\**$", re.I)

NUM_RE = re.compile(r"^[\d,]+$")


def fail(msg):
    raise SystemExit(f"nt-parse: {msg}")


def norm_key(s):
    return re.sub(r"[^A-Z0-9]+", " ", str(s or "").upper()).strip()


def bn_int(v):
    s = re.sub(r"[^\d]", "", str(v or ""))
    return int(s) if s else 0


def clean_txt(frag):
    t = re.sub(r"<br[^>]*>", " ", frag)
    t = re.sub(r"<[^>]+>", "", t)
    return " ".join(_html.unescape(t).split())


def bucket(ab):
    return BUCKETS.get(ab, "ind" if ab in ("", "IND") else "oth")


def roster(year):
    if year not in ROSTERS:
        fail(f"no roster pinned for {year}")
    return sorted(ROSTERS[year])


# --------------------------------------------------------------- registers
def load_pp():
    p = os.path.join(SRCN, "pp-nt.json")
    if not os.path.exists(p):
        return {}
    return json.load(open(p))


# ------------------------------------------------- 2016/2020/2024 HTML era
def find_table_after(h, heading):
    """The first table after a heading that rows-of-cells parse from
    (2024-era pages wrap every table in a fixed js-table-head-wrapper
    clone that carries only <th> — the rows live in the sibling
    js-table-body-wrapper table). Searched up to the next h2/h3."""
    i = h.find(heading)
    if i < 0:
        return None
    seg = h[i:]
    mnext = re.search(r"<h[23][ >]", seg[1:])
    if mnext:
        seg = seg[:1 + mnext.start()]
    for m in re.finditer(r"<table[^>]*>.*?</table>", seg, re.S):
        if re.search(r"<td[ >]", m.group(0)):
            return m.group(0)
    return None


def rows_of(tbl):
    out = []
    for r in re.findall(r"<tr[^>]*>(.*?)</tr>", tbl, re.S):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S)
        out.append([clean_txt(c) for c in cells])
    return out


def _cand_col_match(cands, title, where):
    """A results-table column heading "Given SURNAME (AB)" -> candidate index
    (the surname-token discipline of the summary's own parser)."""
    mm = re.match(r"^(.*?)\s*\(([^)]+)\)\s*$", title.strip())
    if not mm:
        fail(f"{where}: column head {title!r} isn't a 'Name (Party)' cell")
    hdr_sur = mm.group(1).split()[-1].upper()
    hit = [i for i, c in enumerate(cands) if norm_key(c["sur"]) == norm_key(hdr_sur)
           and c["ab"] == mm.group(2).strip()]
    if not hit:
        hit = [i for i, c in enumerate(cands) if norm_key(c["sur"]) == norm_key(hdr_sur)]
    if not hit:
        fail(f"{where}: column {title!r} off the summary roster")
    return hit[0]


def parse_html_dop(year, slug, h, cands, formal, no2cp):
    """The division's "Distribution of preferences" table -> per-round rows
    {excluded (cand idx or None on first-prefs), d (per-candidate transfers),
    exh (that round's exhaust transfer, 0 when the era prints no Exhausted
    column)}. Asserted fail-loud against itself: printed progressives are
    replayed from first preferences and must equal prev+deltas column by
    column; the excluded candidate's own cell negates their standing pile;
    the LIVE rows always sum with exhaust to the division formal. Two-
    candidate seats (no table) and quota-on-primaries seats fall to None."""
    def where(what):
        return f"{year}/{slug}: DOP {what}"
    tbl = find_table_after(h, "Distribution of preferences")
    if tbl is None:
        return None
    rows = rows_of(tbl)
    if not rows or rows[0][:2] != ["Count", "Comments"]:
        fail(where("header drifted"))
    head = [c.strip() for c in rows[0]]
    cand_cols = []      # (col idx, kind, payload) kind in {"cand","exh","meta"}
    has_exh = False
    for ci in range(2, len(head)):
        t = head[ci].rstrip(".")
        if t.lower() in ("total", "quota"):
            cand_cols.append((ci, "meta", None))
        elif t.lower() == "exhausted":
            cand_cols.append((ci, "exh", None))
            has_exh = True
        else:
            cand_cols.append((ci, "cand", _cand_col_match(cands, t, where("header"))))
    if len([c for c in cand_cols if c[1] == "cand"]) != len(cands):
        fail(where("candidate columns don't cover the summary roster"))

    def num(cell):
        s = cell.strip().replace(",", "").replace("(", "-").replace(")", "")
        if s in ("", "–", "-"):
            return 0
        return int(s)

    rounds = []
    piles = {ci: 0 for ci in range(len(cands))}
    exh_pile = 0
    cur = None
    first = True
    for r in rows[1:]:
        if len(r) < len(head):
            # rows can print ragged on the 2016-era tables; pad, never mask
            r = r + [""] * (len(head) - r)
        comment = re.sub(r"\s+", " ", r[1]).strip().rstrip(".")
        if comment.lower() == "progressive":
            if cur is None:
                fail(where("Progressive row without a transfer row"))
            got = {}
            exh_got = exh_pile
            for ci, kind, pay in cand_cols:
                if kind == "cand":
                    got[pay] = num(r[ci])
                elif kind == "exh":
                    exh_got = num(r[ci])
            quirks = []
            for ci in range(len(cands)):
                if piles[ci] != got.get(ci):
                    # 2016-era print quirk: the just-excluded candidate's own
                    # progressive cell re-prints their negated pile on their
                    # exclusion round (Katherine '16); 0 everywhere later.
                    ex_now = cur.get("excluded")
                    pre = cur.get("pre", {})
                    if ex_now is not None and ci == ex_now and got.get(ci) == -pre.get(ci, 0):
                        quirks.append(cands[ci]["name"])
                    else:
                        fail(where(f"round {len(rounds)} progressive {got.get(ci)} !="
                                   f" replayed {piles[ci]} (cand {cands[ci]['name']!r})"))
            if quirks:
                print(f"  nt-parse {year}/{slug}: DOP print quirk (excluded column"
                      f" re-prints its negated pile): {', '.join(quirks)}")
            if exh_pile != exh_got:
                fail(where(f"round {len(rounds)} exhaust {exh_got} != replayed {exh_pile}"))
            live = sum(piles.values()) + (exh_got if has_exh else 0)
            if live != formal:
                fail(where(f"round {len(rounds)} live {live} != formal {formal}"))
            rounds.append(cur)
            cur = None
            continue
        if cur is not None:
            fail(where(f"transfer row {comment!r} lacks its Progressive row"))
        nums = {}
        cur_exh = 0
        for ci, kind, pay in cand_cols:
            if kind == "cand":
                nums[pay] = num(r[ci])
            elif kind == "exh":
                cur_exh = num(r[ci])
        if first:
            if "first preferences" not in comment.lower():
                fail(where(f"first transfer row is {comment!r}, want First preferences"))
            d = {ci: nums.get(ci, 0) for ci in range(len(cands))}
            if any(v < 0 for v in d.values()) or sum(d.values()) != formal or cur_exh != 0:
                fail(where(f"first preferences don't sum to formal "
                           f"({sum(d.values())} of {formal}, exh {cur_exh})"))
            excluded = None
        else:
            m = re.match(r"(.*?)\s+excluded\s*\.?$", comment, re.I)
            if not m:
                fail(where(f"transfer comment unparsable {comment!r}"))
            token = m.group(1).strip()
            mm = re.match(r"^(.*?)\s*\(([^)]+)\)\s*$", token)
            if mm:
                ex = _cand_col_match(cands, f"{mm.group(1)} ({mm.group(2)})", where("excluded name"))
            else:
                sur = token.split()[-1].upper()
                hit = [i for i, c in enumerate(cands) if norm_key(c["sur"]) == norm_key(sur)]
                if len(hit) != 1:
                    fail(where(f"excluded {token!r} matches {len(hit)} candidates"))
                ex = hit[0]
            # exactly the excluded candidate's cell goes negative, of their pile
            d = {ci: nums.get(ci, 0) for ci in range(len(cands))}
            if -d.get(ex, 0) != piles[ex]:
                fail(where(f"excluded {cands[ex]['name']!r} cell {d.get(ex, 0)}"
                           f" doesn't negate their pile {piles[ex]}"))
            others_neg = [cands[ci]["name"] for ci in d if ci != ex and d[ci] < 0]
            if others_neg or cur_exh < 0:
                fail(where(f"unexpected negatives {others_neg} exh {cur_exh}"))
            d[ex] = -piles[ex]
            excluded = ex
        pre = dict(piles)
        for ci, dv in d.items():
            piles[ci] += dv
        exh_pile += cur_exh
        cur = {"d": d, "excluded": excluded, "exh": cur_exh, "pre": pre}
        first = False
    if cur is not None:
        fail(where("table ends on a transfer row (missing Progressive)"))
    if not rounds:
        return None
    live = [(ci, p) for ci, p in piles.items() if p > 0]
    if len(live) == 1 and no2cp:
        # quota cleared on primaries — the printed count just stops
        return None
    if len(live) != 2:
        fail(where(f"final round leaves {len(live)} candidates, want 2"))
    tcp = [(ci, p) for ci, p in live]
    return {"rounds": rounds, "tcp": tcp, "has_exh": has_exh,
            "exhausted": exh_pile if has_exh else 0}


def parse_html_division(year, slug):
    p = os.path.join(SFS, str(year), f"{slug}.html")
    if not os.path.exists(p):
        fail(f"mirror file missing: {p}")
    h = open(p, encoding="utf-8", errors="replace").read()
    display = SLUG_DISPLAY.get(slug) or " ".join(w.title() for w in slug.split("-"))
    if display == "Gwoja":
        pass
    elif display not in ROSTERS.get(year, []):
        fail(f"{year}/{slug}: display {display!r} not on the roster")

    # --- Electorate summary: candidates + tallies
    summ = find_table_after(h, "Electorate summary")
    if summ is None:
        fail(f"{year}/{slug}: no Electorate summary table")
    rows = rows_of(summ)
    head = rows[0]
    if head[:3] != ["Candidate", "Party", "Primary"] or "TCP" not in head:
        fail(f"{year}/{slug}: summary header drifted {head[:6]}")
    # candidate lines are "Given [middle…] SURNAME" — the surname is the
    # last token (NTEC's mixed-case "McADAM" defeats all-caps heuristics)
    cands = []
    formal = informal = enrolled = None
    no2cp = "No two candidate preferred" in h
    for r in rows[1:]:
        if not r or not r[0]:
            continue
        c0 = r[0]
        if c0.startswith("Formal"):
            formal = bn_int(r[1])
        elif c0.startswith("Informal"):
            informal = bn_int(r[1])
        elif c0.startswith("Total counted"):
            pass
        elif c0.startswith("Enrolment"):
            enrolled = bn_int(r[1])
        elif c0.startswith("Exhausted"):
            pass
        elif c0 == "Candidate":
            continue
        else:
            party = r[1].strip() if len(r) > 1 else ""
            prim = bn_int(r[2]) if len(r) > 2 else 0
            tcpv = bn_int(r[3]) if len(r) > 3 and bn_int(r[3]) else None
            toks = c0.strip().split()
            if len(toks) < 2:
                fail(f"{year}/{slug}: candidate line shape drifted {c0!r}")
            given, sur = " ".join(toks[:-1]), toks[-1].upper()
            if not re.match(r"^[A-Z][A-Z'’\-]*$", sur):
                fail(f"{year}/{slug}: surname shape drifted {sur!r} in {c0!r}")
            cands.append({"given": given, "sur": sur, "name": f"{given} {sur}",
                          "ab": party, "prim": prim, "tcpv": tcpv})
    if not cands:
        fail(f"{year}/{slug}: no candidate rows in summary")
    # 2024-era summaries carry the tallies on a separate "Vote Type" table
    # and the enrolment on a following <p>; gather the drifting homes
    if formal is None or informal is None:
        vt_re = re.compile(r"Vote Type.*?Formal\s*</td>\s*<td[^>]*>([\d,]+).*?"
                           r"Informal\s*</td>\s*<td[^>]*>([\d,]+).*?"
                           r"Total counted", re.S)
        m = vt_re.search(h)
        if m:
            formal = bn_int(m.group(1))
            informal = bn_int(m.group(2))
    if enrolled is None:
        m = re.search(r"Enrol(?:l)?ment\s*:\s*([\d,]+)", clean_txt(h))
        if m:
            enrolled = bn_int(m.group(1))
    if formal is None or informal is None or enrolled is None:
        fail(f"{year}/{slug}: summary lacks formal/informal/enrolment "
             f"({formal},{informal},{enrolled})")
    if sum(c["prim"] for c in cands) != formal:
        fail(f"{year}/{slug}: primary sum {sum(c['prim'] for c in cands)}"
             f" != formal {formal}")

    # --- Parties register (long names)
    pn_of = {}
    ptbl = find_table_after(h, "Parties")
    if ptbl:
        for r in rows_of(ptbl)[1:]:
            if len(r) >= 2 and r[0].strip() and r[0] != "Abbreviation":
                pn_of[r[0].strip()] = r[1].strip()

    # --- FP by voting centre
    fp = find_table_after(h, "First preferences by voting centre")
    if fp is None:
        fail(f"{year}/{slug}: no First-preferences table")
    frows = rows_of(fp)
    fhead = [x for x in frows[0]]
    if not fhead or fhead[0] != "Voting centre":
        fail(f"{year}/{slug}: FP table header drift {fhead[:3]}")
    # find candidate columns: headings carry "Given<br>SURNAME<br>(AB)"
    cand_cols = []   # (col index, surname key)
    for ci, title in enumerate(fhead):
        mm = re.match(r"^(.*?)\s*\(([^)]+)\)\s*$", title)
        if mm and ci > 0:
            hdr_sur = mm.group(1).split()[-1].upper()
            hit = [i for i, c in enumerate(cands) if norm_key(c["sur"]) == norm_key(hdr_sur)
                   and c["ab"] == mm.group(2).strip()]
            if not hit:
                hit = [i for i, c in enumerate(cands) if norm_key(c["sur"]) == norm_key(hdr_sur)]
            if not hit:
                fail(f"{year}/{slug}: FP column {title!r} off the roster")
            cand_cols.append((ci, hit[0]))
    if len(cand_cols) != len(cands):
        fail(f"{year}/{slug}: FP columns {len(cand_cols)} != candidates {len(cands)}")
    venue_rows = []
    tfoot_enrolled = None
    for r in frows[1:]:
        if not r or len(r) < 2:
            continue
        nm = r[0].strip()
        if nm.lower().startswith("enrol"):
            tfoot_enrolled = bn_int(r[-1] if len(r) > 1 else r[-1])
            continue
        if nm in ("Voting centre",):
            continue
        if not NUM_RE.match(r[cand_cols[0][0]].replace(",", "") or "0"):
            # percentage footer row etc.
            continue
        votes = [0] * len(cands)
        for ci, ci_c in cand_cols:
            votes[ci_c] = bn_int(r[ci]) if ci < len(r) else 0
        inf = bn_int(r[len(fhead) - 2]) if len(r) >= len(fhead) else 0
        tot = bn_int(r[len(fhead) - 1]) if len(r) >= len(fhead) else 0
        if nm.lower().startswith("total"):
            if sum(votes) != formal:
                fail(f"{year}/{slug}: FP totals row {sum(votes)} != formal {formal}")
            continue
        venue_rows.append({"name": nm, "votes": votes, "informal": inf, "total": tot})
    if tfoot_enrolled is not None and tfoot_enrolled != enrolled:
        fail(f"{year}/{slug}: summary enrolment {enrolled} != FP tfoot {tfoot_enrolled}")

    # --- TCP by voting centre (may be absent on two-candidate seats)
    tcp_tbl = find_table_after(h, "Two candidate preferred by voting centre")
    booth_tcp = {}
    tcp_pair_names = []
    if tcp_tbl:
        trows = rows_of(tcp_tbl)
        thead = [x for x in trows[0]]
        pair_idx = []
        for ci, title in enumerate(thead):
            mm = re.match(r"^(.*?)\s*\(([^)]+)\)\s*$", title)
            if mm and ci > 0:
                hdr_sur = mm.group(1).split()[-1].upper()
                hit = [i for i, c in enumerate(cands) if norm_key(c["sur"]) == norm_key(hdr_sur)]
                if not hit:
                    fail(f"{year}/{slug}: TCP column {title!r} off the roster")
                pair_idx.append((ci, hit[0]))
        tcp_pair_names = [i for _c, i in pair_idx]
        for r in trows[1:]:
            if not r or len(r) < 2:
                continue
            nm = r[0].strip()
            if nm.lower().startswith(("enrol", "total", "percentage")) or nm == "Voting centre":
                continue
            if len(pair_idx) == 2 and NUM_RE.match(r[pair_idx[0][0]].replace(",", "") or "0"):
                booth_tcp[nm] = [bn_int(r[pair_idx[0][0]]), bn_int(r[pair_idx[1][0]])]

    # --- division tcp pair from the summary (or FP on two-candidate seats)
    tcp = []
    fabricated = False
    if len(cands) == 2:
        tcp = [(0, cands[0]["prim"]), (1, cands[1]["prim"])]
        tcp_pair_names = [0, 1] if not tcp_pair_names else tcp_pair_names
    else:
        tcp_rows = [c for c in cands if c["tcpv"] is not None]
        if len(tcp_rows) != 2:
            if no2cp and tcp_pair_names == []:
                # NTEC prints no TCP lane for the division: fall back below
                # to the DOP table's own final pair (the full preferential
                # count IS on the page — e.g. Nelson 2024), and only when
                # nothing was counted at all does the primary top-two stand.
                top2 = sorted(range(len(cands)), key=lambda i: -cands[i]["prim"])[:2]
                tcp = [(i, cands[i]["prim"]) for i in top2]
                fabricated = True
            else:
                fail(f"{year}/{slug}: {len(tcp_rows)} tcp rows on a >2-candidate seat")
        else:
            tcp = [(cands.index(c), c["tcpv"]) for c in tcp_rows]

    # --- Distribution of preferences (independently asserted against the
    # summary's own tcp pair — the two tables must agree to the vote, bar
    # adjudicated late-recount drifts pinned above)
    dop = parse_html_dop(year, slug, h, cands, formal, no2cp) if len(cands) > 2 else None
    if fabricated and dop is not None:
        print(f"  nt-parse {year}/{slug}: summary prints no TCP — the final"
              f" pair comes from the DOP table itself {dict(dop['tcp'])}")
        tcp = list(dop["tcp"])
        no2cp = False
        fabricated = False
    if fabricated:
        print(f"  nt-parse {year}/{slug}: no TCP or DOP — final pair"
              f" fabricated from primaries")
    if dop is not None and not fabricated:
        d_tcp = dict(dop["tcp"])
        s_tcp = dict(tcp)
        if set(d_tcp) != set(s_tcp):
            fail(f"{year}/{slug}: DOP final pair {sorted(d_tcp)} != summary tcp pair {sorted(s_tcp)}")
        drift = {ci: s_tcp[ci] - d_tcp[ci] for ci in s_tcp if s_tcp[ci] != d_tcp[ci]}
        pinned = DOP_SUMMARY_DIVERGENCES.get((year, slug))
        if drift:
            if pinned is None:
                fail(f"{year}/{slug}: DOP final {sorted(d_tcp.items())} !="
                     f" summary tcp {sorted(s_tcp.items())} — adjudicate against"
                     f" NTEC's own pages and pin in DOP_SUMMARY_DIVERGENCES deliberately")
            if drift != pinned:
                fail(f"{year}/{slug}: DOP-summary drift {drift} !="
                     f" pinned {pinned} — the adjudication aged out; re-check the page")
            print(f"  nt-parse {year}/{slug}: DOP-summary divergence {drift}"
                  f" rides its pin (summary canonical)")

    return {"display": display, "cands": cands, "formal": formal,
            "informal": informal, "enrolled": enrolled,
            "venues": venue_rows, "booth_tcp": booth_tcp,
            "tcp": tcp, "pn_of": pn_of, "no2cp": no2cp, "dop": dop}


# ------------------------------------------------------------- 2012 era
def parse_2012():
    txt_p = os.path.join(SFS, "2012", "psephos-nt2012.txt")
    offi_p = os.path.join(SFS, "2012", "2012-official-summary.txt")
    if not (os.path.exists(txt_p) and os.path.exists(offi_p)):
        fail("2012 mirror incomplete (need psephos txt + official summary)")
    lines = open(txt_p, encoding="utf-8", errors="replace").read().splitlines()

    divs = []
    i = 0
    cur = None
    sect = None
    name_re = re.compile(r"^([A-Z][A-Z'’() .\-]+)(?:\s*\(formerly [^)]*\))*\s*$",
                         re.I)
    while i < len(lines):
        ln = lines[i]
        m = name_re.match(ln.strip())
        if m and i + 1 < len(lines) and set(lines[i + 1].strip()) == {"="}:
            nm = re.sub(r"\s*\(formerly [^)]*\)\s*$", "", ln.strip(), flags=re.I)
            nm = nm.title().replace("'S", "'s")
            # psephos prints SHOUTING division names; only roster-exact
            # headers open a division block (the file also carries
            # "NORTHERN TERRITORY"-style summary banners with ==== rules)
            hit = [d for d in ROSTERS[2012] if norm_key(d) == norm_key(nm)]
            cur = None
            sect = None
            if hit:
                cur = {"display": hit[0], "cands": [], "tcp": [],
                       "formal": None, "informal": None, "enrolled": None,
                       "venues": [], "booth_tcp": {}, "pn_of": {}, "no2cp": False}
                divs.append(cur)
            i += 2
            continue
        if cur is None:
            i += 1
            continue
        s = ln.rstrip()
        st = s.strip()
        def lead_num(cell):
            m = re.match(r"[\d,]+", cell.strip())
            return bn_int(m.group(0)) if m else None
        if st.startswith("Enrolled voters:"):
            cur["enrolled"] = lead_num(st.split(":", 1)[1])
        elif st.startswith("Informal votes:"):
            cur["informal"] = lead_num(st.split(":", 1)[1])
        elif st.startswith(("Fornmal votes:", "Formal votes:")):
            cur["formal"] = lead_num(st.split(":", 1)[1])
        elif st.startswith("Candidate"):
            sect = "prim"
        elif st.startswith("Final count"):
            sect = "tcp"
        elif st.startswith("Votes cast:"):
            pass
        elif set(st) <= {"-"} and st:
            sect = sect or None
        elif st and sect in ("prim", "tcp") and not st[0] in "-=":
            parts = re.split(r"\s{2,}", st)
            vi = 1
            if len(parts) >= 3 and not NUM_RE.match(parts[1].replace(",", "")):
                vi = 2  # "<name>  PARTY  votes" layout
            if (len(parts) >= vi + 2 and not parts[0].lower().startswith("total")
                    and NUM_RE.match(parts[vi].replace(",", "").replace("-", ""))):
                nm_p = re.sub(r"\s*[+*]\s*$", "", parts[0])
                party = "IND" if vi == 1 else parts[1]
                votes = parts[vi]
                sur = nm_p.split()[-1]
                given = " ".join(nm_p.split()[:-1]) or nm_p
                rec = {"given": given, "sur": sur.upper(), "name": nm_p,
                       "ab": party, "prim": None, "tcpv": None}
                if sect == "prim":
                    rec["prim"] = bn_int(votes)
                    cur["cands"].append(rec)
                else:
                    rec["tcpv"] = bn_int(votes)
                    cur["_tcp_rows"] = cur.get("_tcp_rows", []) + [rec]
        i += 1
    if len(divs) != 25:
        fail(f"2012 psephos parse: {len(divs)} divisions, want 25")
    for x in divs:
        for need in ("formal", "informal", "enrolled"):
            if x[need] is None:
                fail(f"2012 {x['display']}: missing {need}")
        if sum(c["prim"] for c in x["cands"]) != x["formal"]:
            fail(f"2012 {x['display']}: primary sum != formal")
        tcp_rows = x.get("_tcp_rows", [])
        if len(tcp_rows) != 2:
            if len(x["cands"]) == 2:
                # two-candidate file: no separate count — primaries are the final
                tcp_rows = [{"sur": c["sur"], "ab": c["ab"], "tcpv": c["prim"]}
                            for c in x["cands"]]
            else:
                fail(f"2012 {x['display']}: final count not a pair")
        tcp = []
        for tr in tcp_rows:
            hit = [ci for ci, c in enumerate(x["cands"])
                   if norm_key(c["sur"]) == norm_key(tr["sur"]) and c["ab"] == tr["ab"]]
            if not hit:
                hit = [ci for ci, c in enumerate(x["cands"])
                       if norm_key(c["sur"]) == norm_key(tr["sur"])]
            if not hit:
                fail(f"2012 {x['display']}: finalist {tr['sur']} off the primary roster")
            tcp.append((hit[0], tr["tcpv"]))
        x["tcp"] = tcp

    # official-summary cross-check: Table 1 participation per division
    offi = open(offi_p, encoding="utf-8", errors="replace").read()
    for x in divs:
        # the PDF's text layer can tag rows with a stray superscript glyph
        # ("Nightcliff!") — allow one trailing non-word character
        m = re.search(rf"^{re.escape(x['display'])}[^\w ]?\s+(\d+)\s+(\d+)\s+\S+%\s+(\d+)\s+(\S+)%\s+(\d+)\s+(\S+)%\s*$",
                      offi, re.M)
        if not m:
            fail(f"2012 official summary lacks the {x['display']} row")
        roll, form, infl = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if (form, infl) != (x["formal"], x["informal"]):
            fail(f"2012 {x['display']}: psephos votes ({x['formal']},{x['informal']})"
                 f" != official ({form},{infl})")
        if roll != x["enrolled"]:
            if PSEPHOS_2012_ROLL_OVERRIDES.get(x["display"]) == roll:
                x["enrolled"] = roll
            else:
                fail(f"2012 {x['display']}: psephos roll {x['enrolled']} != official"
                     f" {roll} (extend PSEPHOS_2012_ROLL_OVERRIDES deliberately,"
                     f" never silently)")
    return divs


# ------------------------------------------------------------------ facade
CACHED = {}


def load_frame_year(year):
    if year in CACHED:
        return CACHED[year]
    if year == 2012:
        divs = parse_2012()
    else:
        divs = [parse_html_division(year, slug) for slug in SLUGS[year]]
    if len(divs) != 25:
        fail(f"{year}: {len(divs)} divisions parsed (want 25)")
    pp = load_pp()
    frame = YEAR_FRAME[year]
    districts = []
    for x in divs:
        name = x["display"]
        cands = []
        for ci, c in enumerate(x["cands"]):
            ab = c["ab"]
            pn = x["pn_of"].get(ab) or LONG_NAMES.get(ab, ab or "Independent")
            cands.append({
                "key": (norm_key(name), norm_key(c["sur"]), ab),
                "sur": norm_key(c["sur"]),
                "ab": ab, "ord": ci, "n": c["name"], "pn": pn,
                "b": bucket(ab), "v": c["prim"],
            })
        booths = []
        pseudo_formal = 0
        geo_misses = []
        for vr in x["venues"]:
            vname = re.sub(r"\s*\*\s*$", "", vr["name"]).strip()
            pseudo = (not vname or PSEUDO_VENUE_RE.match(vname) or
                      MOBILE_VENUE_RE.match(vname) or EARLY_OTHER_RE.match(vname))
            if pseudo:
                pseudo_formal += sum(vr["votes"])
                continue
            ty = 5 if EVC_VENUE_RE.search(vname.upper()) else 1
            pk = f"{frame}|{name}|{vname}"
            geo = pp.get(pk)
            if geo is None:
                geo_misses.append(vname)
                lat, lon = None, None
            else:
                lat, lon, ty = geo[0], geo[1], geo[2]
            booths.append({"name": vname, "ty": ty, "lat": lat, "lon": lon,
                           "pv": list(vr["votes"]), "informal": vr["informal"],
                           "tcp": x["booth_tcp"].get(vname) or x["booth_tcp"].get(re.sub(r"\s*\*\s*$", "", vr["name"]).strip())})
        if geo_misses:
            print(f"  nt-parse {frame} {name}: unlocated {sorted(geo_misses)[:6]}")
        if x["venues"]:
            lane = sum(sum(b["pv"]) for b in booths)
            if lane + pseudo_formal != x["formal"]:
                fail(f"{frame} {name}: lane {lane} + pseudo {pseudo_formal}"
                     f" != district formal {x['formal']}")
        if x["booth_tcp"]:
            # the TCP-by-centre table is independently totalled — its own
            # venue rows must sum to the division tcp (venued or not)
            sums = [sum(v[0] for v in x["booth_tcp"].values()),
                    sum(v[1] for v in x["booth_tcp"].values())]
            div_tot = [x["tcp"][0][1], x["tcp"][1][1]]
            if sums != div_tot:
                fail(f"{frame} {name}: TCP-by-centre rows {sums} != "
                     f"division tcp {div_tot}")
        tcp = [{"key": cands[ci]["key"], "v": v} for ci, v in x["tcp"]]
        elected = None
        winv = -1
        for t in tcp:
            if t["v"] > winv:
                winv, elected = t["v"], t["key"]
        districts.append({"name": name, "cands": cands, "booths": booths,
                          "tcp": tcp, "elected": elected,
                          "formal": x["formal"], "informal": x["informal"],
                          "enrolled": x["enrolled"],
                          "dop": x.get("dop"),
                          "zero_rows": 0})
    out = {"year": year, "districts": districts}
    CACHED[year] = out
    return out


def load(frame):
    return load_frame_year(FRAME_YEAR[frame])
