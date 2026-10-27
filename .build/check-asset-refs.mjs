/* check-asset-refs.mjs — every tracked HTML document's local asset refs
   must resolve to files in the tree.

   The 2026-10-28 incident: a partial-commit wrapper pushed the rebuilt root
   page alone, leaving all nine tab documents pointing at the newly-renamed
   data-*.js asset the commit had not carried — every tab page 404'd its
   data bundle on the live site for ~7h (crashed scripts behind a blank
   phone viewport). Nothing tested the "document ↔ its refs" invariant on
   the committed tree; this closes it. refresh_site runs this before the
   caller stages, so a torn tree can no longer be COMMITTED by any wrapper,
   and npm test runs it so a torn push goes red regardless.

   Deliberate scope: refs a page declares in markup — <script src>,
   <link href>, media <img/src/source src>, <use href> — resolving
   site-root ("/x") and doc-relative ("../x") paths the way the browser
   does, query/hash stripped. External (http/data/mailto/#) refs are not
   checked. Anchor/meta-refresh targets are navigation, not assets.
   .build/ mirrors of SOURCE pages (AEC snapshots etc.) are not site
   documents and are not checked either. */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOT_SITE = /^(?:\.build|\.matilda|\.claude|\.github|\.impeccable|\.pnpm|\.worktrees|node_modules)\//;

const lsFiles = (extra) => execFileSync("git", ["ls-files", ...extra, "*.html"], { cwd: ROOT, encoding: "utf8" })
  .split("\n").filter(Boolean);
/* tracked pages plus untracked ones a build just emitted (e.g. vic/cycles'
   debut): refresh_site runs this BEFORE the wrapper's git add, so a brand-
   new page must be checked now too */
const docs = [...new Set([...lsFiles([]), ...lsFiles(["--others", "--exclude-standard"])])]
  .filter((d) => !NOT_SITE.test(d));

const ATTR_RE = /<(script|link|img|video|audio|source|use)\b[^>]*?(?:src|href)\s*=\s*(["'])([^"']+)\2/gi;
const URL_RE = /url\(\s*(["']?)([^"')]+)\1\s*\)/g;
const SKIP = /^(?:https?:)?\/\/|^(?:data|mailto|tel|sms|javascript):/i;
/* #f and its url-encoded twin %23f are internal svg fragments (the
   data-URI icons carry url(%23f)/url(%23g)) — never file paths */
const FRAG = /^#|^%23/i;

function refsOf(html, isCss) {
  const out = [];
  ATTR_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_RE.exec(html))) out.push(m[3]);
  return out.concat(isCss ? cssUrls(html) : []);
}
function cssUrls(css) {
  const out = [];
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(css))) if (!SKIP.test(m[2].trim())) out.push(m[2].trim());
  return out;
}

/* inline <style> bodies ride their document — fonts/art referenced from
   inline CSS rot in exactly the same way as a renamed script */
function inlineCssOf(html) {
  const css = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html))) css.push(m[1]);
  return css;
}

let refs = 0;
const missing = [];
for (const doc of docs) {
  const abs = path.join(ROOT, doc);
  if (!fs.existsSync(abs)) continue; // e.g. submodule-ish pathspecs; none today
  const html = fs.readFileSync(abs, "utf8");
  const docDir = path.dirname(doc);
  const all = refsOf(html, false).concat(inlineCssOf(html).flatMap((c) => cssUrls(c)));
  for (const raw of all) {
    const ref = raw.trim();
    if (!ref || SKIP.test(ref) || FRAG.test(ref)) continue;
    refs++;
    const clean = ref.split(/[?#]/, 1)[0];
    if (!clean) continue;
    const target = clean.startsWith("/") ? path.join(ROOT, clean) : path.join(ROOT, docDir, clean);
    const rel = path.relative(ROOT, target);
    if (rel.startsWith("..")) continue; // points outside the repo — nothing we can verify
    if (!fs.existsSync(target)) missing.push({ doc, ref: raw });
  }
}

if (missing.length) {
  console.error(`FAIL asset-ref check: ${missing.length} missing ${missing.length === 1 ? "reference" : "references"}`);
  for (const m of missing.slice(0, 40)) console.error(`  ${m.doc}: ${m.ref}`);
  if (missing.length > 40) console.error(`  … and ${missing.length - 40} more`);
  process.exit(1);
}
console.log(`asset-refs OK: ${docs.length} documents, ${refs} local refs, every one resolves`);
