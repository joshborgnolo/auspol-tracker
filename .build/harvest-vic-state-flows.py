"""Mirror VEC election-era result files into .build/state-flow-src/vic/<year>/.

Sources (all official VEC):
  - Azure blob mirror: itsitecoreblobvecprd01/public-files/historical-results/state{2006,2010,2014,2018}/
    (manifest-<year>.txt files already saved in this directory)
  - 2022 live district pages: https://www.vec.vic.gov.au/results/state-election-results/
    2022-state-election-results/results-by-district/<slug>-district-results

Only downloads files missing locally; idempotent re-runs.
"""
import sys, os, subprocess, urllib.parse, concurrent.futures

ROOT = ".build/state-flow-src/vic"
BLOB = "https://itsitecoreblobvecprd01.blob.core.windows.net/public-files/"

def fetch(url, dest, timeout=120):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return None
    r = subprocess.run(["curl", "-sf", "--max-time", str(timeout), "-o", dest, url + ""],
                       capture_output=True, text=True)
    if r.returncode != 0:
        # annotate non-200/transfer error, leave no partial file behind
        if os.path.exists(dest):
            os.remove(dest)
        return f"FAIL {r.returncode} {url}"
    return None

def harvest_from_manifest(year):
    outdir = os.path.join(ROOT, str(year))
    os.makedirs(outdir, exist_ok=True)
    names = [l.strip() for l in open(os.path.join(ROOT, f"manifest-{year}.txt")) if l.strip()]
    jobs = []
    for name in names:
        base = os.path.basename(name)
        if base in ("links.txt", "reports.txt"):
            dest = os.path.join(outdir, base)
        else:
            dest = os.path.join(outdir, base)
        url = urllib.parse.urljoin(BLOB, urllib.parse.quote(name))
        jobs.append((url, dest))
    done = fail = 0
    errs = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for res in ex.map(lambda j: fetch(*j), jobs):
            if res:
                errs.append(res); fail += 1
            else:
                done += 1
    print(f"{year}: {done} ok, {fail} failed ({len(jobs)} files listed)")
    for e in errs[:10]:
        print("   ", e)
    return fail

def main():
    years = [2006, 2010, 2014, 2018]
    if len(sys.argv) > 1:
        years = [int(y) for y in sys.argv[1:]]
    bad = sum(harvest_from_manifest(y) for y in years)
    sys.exit(0 if bad == 0 else 1)

if __name__ == "__main__":
    main()
