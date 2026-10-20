"""Mirror the ECSA House of Assembly final distributions of preferences.

2022 – .build/state-flow-src/sa/2022/src.zip + x/2022SE HA Final distribution
csv/*.csv (47 per-district CSVs).
https://www.ecsa.sa.gov.au/elections/past-elections lists past-elections
articles. The 2022 statistics article (article id=636) carries a Joomla
edocman download link to id=244 which serves the 47-district CSV bundle.
The link label at the time said "ha-final-distribution.pdf" but the
payload was always a zip; the fetch here probes the payload with the
``file`` utility and renames it before extraction so the committed mirror
is the real zip.

2026 – .build/state-flow-src/sa/2026/{static,change}.json, verbatim from the
API behind the ECSA results site (result.ecsa.sa.gov.au, an Angular app
whose main bundle names the base URL): HAStatic/2026-03-21 carries each
district's candidates with their party ids, HAChange/2026-03-21/0 the final
results, every district's finalDistribution among them (round 0 the first
preferences, then one ExclusionRoundN per exclusion: each candidate's
voteChange and progressiveTotal). The HAChange id names the distribution's
candidates differently from HAStatic, so the parser joins them by name. The
API's 2022 HAChange carries no finalDistribution, hence the CSVs for 2022.

Probes performed on 2026-10-20 confirmed the 2014 and 2018 elections are
NOT mechanically mirrored on this site: the Joomla walk across doc ids
100-700 returned only single-page PDF info sheets and the 2014/2018
statistics articles themselves link per-district first-preferences-only
pages.

Only downloads what is missing; idempotent. 2026 refuses a payload that is
not electionStatus "final" or lacks a district's distribution.
"""
import json
import os
import subprocess
import sys
import zipfile

ROOT26 = ".build/state-flow-src/sa/2026"
API = "https://apim-ecsa-production.azure-api.net/results-display/"
API_HEADERS = ["-H", "Origin: https://result.ecsa.sa.gov.au", "-A", "Mozilla/5.0"]

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


def harvest_2026():
    os.makedirs(ROOT26, exist_ok=True)
    want = {"static.json": "HAStatic/2026-03-21", "change.json": "HAChange/2026-03-21/0"}
    for name, path in want.items():
        dest = os.path.join(ROOT26, name)
        if os.path.exists(dest):
            continue
        tmp = dest + ".part"
        r = run(["curl", "-sf", "--max-time", "300", *API_HEADERS, "-o", tmp, API + path])
        if r.returncode != 0:
            if os.path.exists(tmp):
                os.remove(tmp)
            print(f"2026: FAIL curl {r.returncode} {API + path}")
            return 1
        os.replace(tmp, dest)
    change = json.load(open(os.path.join(ROOT26, "change.json")))
    static = json.load(open(os.path.join(ROOT26, "static.json")))
    nd = [d for d in change.get("districts", []) if d.get("finalDistribution")]
    if change.get("electionStatus") != "final" or len(nd) != len(static.get("districts", [])) or not nd:
        print(f"2026: payload not final or incomplete (status {change.get('electionStatus')}, "
              f"{len(nd)} distributions for {len(static.get('districts', []))} districts)")
        return 1
    print(f"2026: mirrored HAStatic + HAChange (dataVersion {change.get('dataVersion')}, "
          f"{len(nd)} district distributions)")
    return 0


def main():
    return harvest_2022() or harvest_2026()


def harvest_2022():
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
