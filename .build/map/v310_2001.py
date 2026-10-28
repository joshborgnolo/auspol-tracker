#!/usr/bin/env python3
"""Parser for the 2001-election "Two Candidate Preferred Preference Flow
Result" tables (the v3_10<DIV>.txt members of aec-2001-election-statistics.zip,
collated as .build/aec-flow-src/v310-2001.txt.gz; see pack-2001-booth.py).

These files carry the AEC's OFFICIAL record of where each excluded
candidate's first preferences finished in the division's final pair -
data the count-by-count summaries (HPPDOP) cannot reconstruct (a
candidate's pile mixes ballots with different next preferences), and the
numbers seats already committed in tcp-2001.json.gz independently
reproduce (party-for-party, division-for-division).

Per file (tab-delimited, CRLF; documented in the pack's own
data/stats/house_reps.pdf):

  House of Representatives - 2001 Election: <State>
  Two Candidate Preferred Preference Flow Result
  By Polling Place

  <Division> (<enrolment>)
          Candidate  "FINALIST A"   "FINALIST B"     Total
                     PARTY A         PARTY B
                     Votes  %        Votes   %

  \t<venue>
  \t\t1st Prefs   fpA  pcA   fpB  pcB    <fp sum>
  \t\t"EXCLUDED, C (PTY)"  fp   toA  toA%   toB  toB%    fp
  \t\tTotal        excfp  tcpA  tcpA%   tcpB  tcpB%  formal
  \t<venue> ...
  \tABSENT / POSTAL / PRE_POLL / PROVISIONAL   (declaration aggregates;
            the underscore in PRE_POLL is the pack's)
  \tSpecial Hospitals (148 divisions) / Prison Mobiles (14) /
            Remote Mobiles (5)             (pseudo-venue aggregates)
  \tTotal Ordinary                            (venue-class aggregate)
  \tDivision Summary                          (the whole division)

Sections are keyed on the printed names; exposed API: split_members(),
parse_member(), parse_all() (150 divisions, one each - the collated pack
asserts that itself).

Every printed number is a pure integer in the table - thousands commas or
dashes in a future edition fail the strict regexes loudly, never silently
(as does any venue section missing its 1st Prefs or Total rows).
"""
import gzip, re

DECL_MAP = {"ABSENT": "ABSENT", "PRE_POLL": "PRE POLL", "POSTAL": "POSTAL", "PROVISIONAL": "PROVISIONAL"}
AGGREGATE_SECTIONS = ("Total Ordinary", "Division Summary")
PSEUDO_SECTIONS = AGGREGATE_SECTIONS + ("Special Hospitals", "Prison Mobiles", "Remote Mobiles")


def _repo_root():
    import os
    return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


def collated_path():
    return _repo_root() + "/.build/aec-flow-src/v310-2001.txt.gz"


def split_members(path=None):
    blob = gzip.decompress(open((path or collated_path()), "rb").read()).decode("utf-8")
    for chunk in blob.split("<<<<<"):
        if not chunk.strip():
            continue
        member, body = chunk.split(">>>>>\n", 1)
        yield member, body


def split_name_party(tok):
    """'O'LEARY, Ken (AFI)' -> ("O'LEARY, Ken", 'AFI'); a party-less name -> IND"""
    m = re.match(r"^(.*?)\s+\(([^()]*)\)\s*$", tok)
    if m:
        return m.group(1), (m.group(2) or "IND")
    return tok, "IND"


def leading_tabs(ln):
    k = 0
    for ch in ln:
        if ch == "\t":
            k += 1
        else:
            break
    return k


def parse_member(body):
    lines = body.splitlines()
    assert lines[0].startswith("House of Representatives -"), lines[0][:60]
    div = enrol = None
    for ln in lines[:12]:
        m = re.match(r"^([A-Za-z][A-Za-z' -]*)\s\((\d+)\)[\s\t]*$", ln)
        if m:
            div, enrol = m.group(1), int(m.group(2))
            break
    assert div, "v3_10 member without a '<Division> (<enrolment>)' header"

    # the finalists. The Candidate row can carry the finals' names whole, or
    # split-wrapped: quoted fragments on the wrapped header line right above
    # ("ALBISTON, " / "HULL,") with bare tails on the Candidate row itself.
    fi = next(i for i, ln in enumerate(lines) if re.match(r"^\s*Candidate\b", ln))
    cand_ln = lines[fi].strip()
    tail = cand_ln[len("Candidate"):]
    tail_wo_total = re.sub(r"\s*Total\s*$", "", tail)
    q_here = re.findall(r'"([^"]+)"', tail_wo_total)
    bare = [t for t in tail_wo_total.split("\t") if t.strip() and '"' not in t]
    q_pre = []
    for j in range(fi - 1, max(fi - 5, -1), -1):
        if not lines[j].strip():
            break  # stop at an empty line: the wrapped block is contiguous
        q_pre = re.findall(r'"([^"]+)"', lines[j]) + q_pre
    if q_here:
        names = q_here
    elif q_pre and len(bare) == len(q_pre):
        names = [(q_pre[k] + " " + bare[k].strip()).strip() for k in range(len(q_pre))]
    elif q_pre:
        names = q_pre
    elif not q_here and not q_pre and len(bare) >= 2:
        names = bare
    assert len(names) == 2, (lines[fi], q_pre, bare)
    parties = None
    for j in range(fi + 1, min(fi + 4, len(lines))):
        toks = [t for t in lines[j].split() if t]
        if len(toks) == 2 and all(re.fullmatch(r"[A-Z]{1,5}", t) for t in toks):
            parties = toks
            break
    assert parties, f"{div}: no party row after the Candidate row"
    pair = [(names[0], parties[0]), (names[1], parties[1])]

    sections = {}
    sect = None
    for ln in lines[fi + 1:]:
        if not ln.strip():
            continue
        st = ln.strip()
        ind = leading_tabs(ln)
        if ind == 1 and '"' not in ln and not st.startswith("1st Prefs"):
            assert st not in sections, f"{div}: duplicate section {st}"
            sect = st
            sections[st] = {"name": DECL_MAP.get(st, st), "excl": []}
            continue
        if st.startswith("1st Prefs"):
            if re.fullmatch(r"1st Prefs\s+0\s+0", st):
                # zero-count pseudo venue (the combined teams like Kingsford
                # Smith's "Express" report 0 ballots — import_files note 10)
                assert sect, f"{div}: zero 1st Prefs outside a section"
                sections[sect]["fp"] = [0, 0]
                sections[sect]["fpsum"] = 0
                continue
            m = re.match(r"^1st Prefs\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+)$", st)
            assert m and sect, f"{div}: bad 1st Prefs line: {st!r}"
            sections[sect]["fp"] = [int(m.group(1)), int(m.group(3))]
            sections[sect]["fpsum"] = int(m.group(5))
            continue
        if st.startswith('"'):
            m = re.match(r'^"([^"]+)"\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(?:(\d+)\s+)?(\d+)$', st)
            assert m and sect, f"{div}: bad flow row: {st!r}"
            cd, ab = split_name_party(m.group(1))
            fp, to_a, to_b = int(m.group(2)), int(m.group(3)), int(m.group(5))
            exh = int(m.group(7)) if m.group(7) else 0
            assert exh == 0, f"{div} {sect}: exhausted votes appear in 2001 — the no-exhaustion premise moved: {st!r}"
            sections[sect]["excl"].append((cd, ab, fp, to_a, to_b))
            continue
        if st.startswith("Total"):
            m = re.match(r"^Total\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(?:(\d+)\s+)?(\d+)$", st)
            assert m and sect, f"{div}: bad Total line: {st!r}"
            exh = int(m.group(6)) if m.group(6) else 0
            assert exh == 0, f"{div} {sect}: exhausted votes appear in 2001 — the no-exhaustion premise moved: {st!r}"
            sections[sect]["total"] = (int(m.group(1)), int(m.group(2)), int(m.group(4)), int(m.group(7)))
            continue
        tok2 = st.split()
        m1 = st == "Candidate" or st.startswith(("Votes", "Candidate"))
        m2 = len(tok2) == 2 and all(re.fullmatch(r"[A-Z]{1,5}", tk) for tk in tok2)
        if not (m1 or m2) and not st.startswith(("House of Representatives", "Two Candidate", "By Polling Place")):
            raise AssertionError(f"{div}: unparsed line {ln!r}")
    missing = [s for s, r in sections.items() if "fp" not in r or "total" not in r]
    assert not missing, f"{div}: sections missing fp/total rows: {missing}"
    return div, {"pair": pair, "enrolment": enrol, "sections": sections}


def parse_all(path=None):
    out = {}
    for member, body in split_members(path):
        div, rec = parse_member(body)
        assert div not in out, f"{div} twice in the collated pack"
        out[div] = rec
    assert len(out) == 150, len(out)
    return out


if __name__ == "__main__":
    import collections
    d = parse_all()
    cnt = collections.Counter(s for r in d.values() for s in r["sections"])
    for s in ("Total Ordinary", "Division Summary", "Special Hospitals", "Prison Mobiles", "Remote Mobiles"):
        print(f"  {s}: {cnt.get(s, 0)}")
    print(len(d), "divisions; sample of venue-section names:", sorted(set(s for r in d.values() for s in r["sections"]))[:6])
