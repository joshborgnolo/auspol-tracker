/* check-asset-refs.mjs — every site document's local asset refs must
   resolve to files the reader will actually be served.

   The 2026-10-28 incident: a partial-commit wrapper pushed the rebuilt root
   page alone, leaving all nine tab documents pointing at the newly-renamed
   data-*.js asset the commit had not carried — every tab page 404'd its
   data bundle on the live site for ~7h (crashed scripts behind a blank
   phone viewport). Nothing tested the "document ↔ its refs" invariant on
   the committed tree; this closed it: refresh_site runs the check before
   the caller stages, so a torn tree can no longer be COMMITTED by any
   wrapper, and npm test runs it so a torn push goes red regardless.

   The 2026-10-31 incident was the inverse shape and slipped past: a sibling
   rebuild in the shared checkout re-hashed the federal layers and swept
   late-css.deff1edb.js + rd-public-opinion.7f636c3b.js out of the worktree,
   and the vic commit's `git add assets/` shipped the DELETIONS while the
   pages pointing at them (unchanged in that commit) stayed on main — the
   Now page 404'd its late styles live. Two holes conspired: the worktree
   check can never see a deletion-only tear (the deleted file's pages sit
   unchanged in HEAD), and both refs were JS config strings
   (window.AP_LATE), invisible to an attribute scan. Closed here and in its
   siblings:

   - extraction moved to .build/asset-refs.mjs, which unions markup attrs
     and inline-CSS url() with bare assets/… strings, so loader config
     (AP_LATE / AP_CYCLE_SRC / AP_ONEOFF_SRC) counts as a reference;
   - `--tree <ref>` audits documents and files INSIDE a committed tree —
     push_main runs it on HEAD before every push, and npm test on HEAD so
     anything that still slips lands red;
   - build.mjs's sweeps never delete a file HEAD's documents reference.

   Worktree mode (no args) is the refresh_site gate, unchanged in spirit:
   pages on disk vs files on disk, run before the wrapper's git add.
   Refs outside the repo or external (http/data/mailto/#) are not checked.
   .build mirrors of SOURCE pages are not site documents. */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { NOT_SITE, refsOfDocument, referencedAssets } from "./asset-refs.mjs";

const ROOT = process.env.AUSPOL_ROOT
  ? path.resolve(process.env.AUSPOL_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const treeAt = argv.indexOf("--tree");
const treeRef = treeAt !== -1 ? argv[treeAt + 1] : null;

const fail = (missing, label) => {
  console.error(`FAIL asset-ref check${label}: ${missing.length} missing ${missing.length === 1 ? "reference" : "references"}`);
  for (const m of missing.slice(0, 40)) console.error(`  ${m.doc}: ${m.ref}`);
  if (missing.length > 40) console.error(`  … and ${missing.length - 40} more`);
  process.exit(1);
};

if (treeRef) {
  /* Committed-tree audit: the documents and the files both live in the
     tree, so a deletion-only tear (the 2026-10-31 shape) is judged exactly
     as the live site would serve it. */
  const names = execFileSync("git", ["ls-tree", "-r", "--name-only", treeRef], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 27,
  }).split("\n").filter(Boolean);
  const present = new Set(names);
  const docs = names.filter((d) => d.endsWith(".html") && !NOT_SITE.test(d));
  let refs = 0;
  const missing = [];
  for (const doc of docs) {
    const html = execFileSync("git", ["show", `${treeRef}:${doc}`], {
      cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 27,
    });
    for (const ref of refsOfDocument(html, doc)) {
      refs++;
      if (!present.has(ref)) missing.push({ doc, ref });
    }
  }
  if (missing.length) fail(missing, ` (tree ${treeRef})`);
  console.log(`asset-refs OK (tree ${treeRef}): ${docs.length} documents, ${refs} local refs, every one resolves`);
  process.exit(0);
}

const lsFiles = (extra) => execFileSync("git", ["ls-files", ...extra, "*.html"], { cwd: ROOT, encoding: "utf8" })
  .split("\n").filter(Boolean);
/* tracked pages plus untracked ones a build just emitted (e.g. vic/cycles'
   debut): refresh_site runs this BEFORE the wrapper's git add, so a brand-
   new page must be checked now too */
const docs = [...new Set([...lsFiles([]), ...lsFiles(["--others", "--exclude-standard"])])]
  .filter((d) => !NOT_SITE.test(d));

let refs = 0;
const missing = [];
for (const doc of docs) {
  const abs = path.join(ROOT, doc);
  if (!fs.existsSync(abs)) continue; // e.g. submodule-ish pathspecs; none today
  const html = fs.readFileSync(abs, "utf8");
  for (const ref of refsOfDocument(html, doc)) {
    refs++;
    if (!fs.existsSync(path.join(ROOT, ref))) missing.push({ doc, ref });
  }
}

if (missing.length) fail(missing, "");
console.log(`asset-refs OK: ${docs.length} documents, ${refs} local refs, every one resolves`);