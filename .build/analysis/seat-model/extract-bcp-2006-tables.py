#!/usr/bin/env python3
"""Materialise 2006-BCP per-CD tables into .matilda/seifa-irsad-abs/dl/cd06/.

The venue-era 2006-census readers (derive-booth-demo-2006.py /
derive-booth-demo-2004c1.py) open per-CD table CSVs as flat
CD_<STATE>_<TABLE>.csv beside census06bcp.zip. The per-CD products
live inside the archive's NESTED release zip
(Basic Community Profile/BCP_ASGC_06_R2.1.zip —
"Release 2 CD-Rom Containment"), under CD/<STATE>/; the archive's own
peer STE_<ST>_<T>.csv files are the state-level tier (2 lines, a
state-total row only) and are never what a lane reader wants.
This unpacker materialises the requested tables' per-CD members
byte-for-byte, so the reads stay a deterministic join off the
committed archive.

Run:  python3 .build/analysis/seat-model/extract-bcp-2006-tables.py
      --tables B01,B07,B13,B15_B,B24,B32         (the new-lane arc)
      python3 .build/analysis/seat-model/extract-bcp-2006-tables.py --all
"""

import io
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

BCP_ZIP = ROOT / ".matilda/seifa-irsad-abs/dl/census06bcp.zip"
INNER = "Basic Community Profile/BCP_ASGC_06_R2.1.zip"
CD06 = ROOT / ".matilda/seifa-irsad-abs/dl/cd06"
STATES = ["NSW", "Vic", "Qld", "SA", "WA", "Tas", "NT", "ACT", "OT"]


def main():
    tables = None
    for a in sys.argv[1:]:
        if a == "--all":
            tables = None
            continue
        if a.startswith("--tables="):
            tables = set(a.split("=", 1)[1].split(","))
            continue
    if not BCP_ZIP.exists():
        raise SystemExit(f"missing {BCP_ZIP}")
    z = zipfile.ZipFile(BCP_ZIP)
    if INNER not in z.namelist():
        raise SystemExit(f"{BCP_ZIP.name} lacks nested {INNER}")
    inner = zipfile.ZipFile(io.BytesIO(z.read(INNER)))
    names = inner.namelist()
    written = 0
    CD06.mkdir(parents=True, exist_ok=True)
    for st in STATES:
        for n in names:
            base = n.split("/")[-1]
            if not base.startswith(f"CD_{st}_") or not base.endswith(".csv"):
                continue
            tab = base[len(f"CD_{st}_"):-4]
            if tables is not None and tab not in tables:
                continue
            out = CD06 / base
            info = inner.getinfo(n)
            if out.exists() and out.stat().st_size == info.file_size:
                continue
            out.write_bytes(inner.read(n))
            written += 1
    print(f"OK: wrote {written} per-CD table files into {CD06}")


if __name__ == "__main__":
    main()

