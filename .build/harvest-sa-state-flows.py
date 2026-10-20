"""Mirror the ECSA 2022 State Election House of Assembly Final Distribution
of Preferences archive into .build/state-flow-src/sa/2022/src.zip +
x/2022SE HA Final distribution csv/*.csv (47 per-district CSVs).

Source
------
https://www.ecsa.sa.gov.au/elections/past-elections lists past-elections
articles. The 2022 statistics article (article id=636) carries a Joomla
edocman download link to id=244 which serves the 47-district CSV bundle.
The link label at the time said "ha-final-distribution.pdf" but the
payload was always a zip; the fetch here probes the payload with the
``file`` utility and renames it before extraction so the committed mirror
is the real zip.

Probes performed on 2026-10-20 confirmed the 2014 and 2018 elections are
NOT mechanically mirrored on this site: the Joomla walk across doc ids
100-700 returned only single-page PDF info sheets and the 2014/2018
statistics articles themselves link per-district first-preferences-only
pages. Scope is therefore 2022 alone.

Only downloads when src.zip is missing; idempotent.
"""
import os
import subprocess
import sys
import zipfile

ROOT = ".build/state-flow-src/sa/2022"
# Article id=636 ("2022 State Election - final distribution of preferences")
# links this download. The served filename lies (".pdf") and the payload is
# a zip of per-district CSVs; we save it as src.zip.
URL = ("https://www.ecsa.sa.gov.au/component/edocman/"
       "244-2022se-ha-final-distribution/download?Itemid=0")
XDIR = "x/2022SE HA Final distribution csv"


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def is_zip(path):
    r = run(["file", "-b", path])
    out = (r.stdout or "").lower()
    return "zip" in out or "archive" in out


def main():
    out_root = ROOT
    zpath = os.path.join(out_root, "src.zip")
    xml_dir = os.path.join(out_root, XDIR)
    if os.path.isdir(xml_dir) and any(n.endswith(".csv") for n in os.listdir(xml_dir)):
        print("2022: already mirrored")
        return 0
    os.makedirs(out_root, exist_ok=True)
    if not os.path.exists(zpath):
        r = run(["curl", "-sfL", "--max-time", "180", "-o", zpath, URL])
        if r.returncode != 0:
            print(f"2022: FAIL curl {r.returncode} {URL}")
            return 1
    if not is_zip(zpath):
        print(f"2022: payload is not a zip ({run(['file','-b',zpath]).stdout.strip()})")
        return 1
    xroot = os.path.join(out_root, "x")
    os.makedirs(xroot, exist_ok=True)
    with zipfile.ZipFile(zpath) as z:
        z.extractall(xroot)
    if not os.path.isdir(xml_dir):
        # tolerate a slightly different top-level folder name
        for top in os.listdir(xroot):
            cand = os.path.join(xroot, top)
            if os.path.isdir(cand):
                names = [n for n in os.listdir(cand) if n.lower().endswith(".csv")]
                if names:
                    # normalise path: rename dir to XDIR
                    if top != XDIR:
                        os.rename(cand, xml_dir)
                    break
    if not os.path.isdir(xml_dir):
        print("2022: no per-district CSV dir found after extraction")
        return 1
    n = sum(1 for n in os.listdir(xml_dir) if n.lower().endswith(".csv"))
    kb = os.path.getsize(zpath) // 1024
    print(f"2022: mirrored {URL.split('/')[-2]} -> {xml_dir} ({n} CSVs, zip {kb} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
