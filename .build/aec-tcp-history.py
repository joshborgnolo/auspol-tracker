"""aec-tcp-history.py - the AEC's counted two-candidate flows BY DIVISION for
1996, 1998 and 2001, so the state-flows estimator can be back-tested and
calibrated on them seat by seat (as it is on 2007-2025's flow-by-division
downloads). aec-flow-history.py's classic-<year>.json keeps only national
sums, and its 2001 reader missed nine classic seats whose files name the
final pair differently.

Source: the AEC statistics packs (aec.gov.au/About_AEC/Publications/
statistics/files/aec-1993-1996-1998-election-statistics.zip and
aec-2001-election-statistics.zip, ~160MB, never committed): the "Two
Candidate Preferred Preference Flow Result" tables - 1996/98 V3_1<state>.TXT,
2001 v3_10<division>.txt. Each division's "Division Summary" block names its
final pair (candidate line, then their party codes) and splits every other
candidate's own first preferences between them.

Output: .build/aec-flow-src/tcp-<year>.json.gz -
{division: {"pair": [code1, code2], "from": [[code, to1, to2], ...]}}.
Usage: python3 .build/aec-tcp-history.py <dir holding the two zips>
"""
import gzip
import json
import os
import re
import sys
import zipfile

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aec-flow-src")
SPECS = {1996: ("aec-1993-1996-1998-election-statistics.zip", r"data/repsres/tables96/text/V3_1\w+\.TXT$"),
         1998: ("aec-1993-1996-1998-election-statistics.zip", r"data/repsres/tables98/text/V3_1\w+\.TXT$"),
         2001: ("aec-2001-election-statistics.zip", r"data/\w+/\w+_txt/v3_10\w+\.txt$")}
DIV = re.compile(r"^([A-Z][A-Za-z' .-]+?) \(\d+\)\s*$")
NUM = re.compile(r"^-?\d+(\.\d+)?$")


def cells(line):
    return [c.strip().strip('"') for c in line.split("\t") if c.strip()]


def parse(text, out):
    lines = text.replace("\r", "").split("\n")
    div, pair = None, None
    for i, ln in enumerate(lines):
        m = DIV.match(ln.strip())
        if m:
            div, pair = m.group(1).strip(), None
        # the finalists' codes: a line of exactly two party codes (in each
        # 1996/98 block's head; once at the top of a 2001 division's file)
        cs = cells(ln)
        if len(cs) == 2 and all(re.match(r"^[A-Z]{2,5}$", c) for c in cs):
            pair = cs
        if not ln.strip().startswith("Division Summary") or div is None:
            continue
        codes = pair
        if not codes:
            raise SystemExit(f"{div}: no final pair")
        j = next(k for k in range(i + 1, len(lines)) if "1st Prefs" in lines[k]) + 1
        rows = []
        while j < len(lines) and lines[j].strip():
            cs = cells(lines[j])
            if cs and cs[0] == "Total":
                break
            m = re.match(r"^(.*)\((\w+)\)$", cs[0]) if cs else None
            if m:
                nums = [float(c) for c in cs[1:] if NUM.match(c)]
                # own first preferences, then votes and % to each finalist
                rows.append([m.group(2), nums[1], nums[3]])
            j += 1
        out[div] = {"pair": codes, "from": rows}


def main():
    src = sys.argv[1]
    for y, (zname, pat) in SPECS.items():
        z = zipfile.ZipFile(os.path.join(src, zname))
        out = {}
        for n in sorted(z.namelist()):
            if re.search(pat, n):
                parse(z.read(n).decode("latin-1"), out)
        with gzip.GzipFile(os.path.join(OUT, f"tcp-{y}.json.gz"), "wb", mtime=0) as f:
            f.write(json.dumps(out, sort_keys=True, separators=(",", ":")).encode())
        print(y, len(out), "divisions")


if __name__ == "__main__":
    main()
