---
name: mac-laptop-cleanups
description: Playbook for "do I need to keep this dir/app on my laptop?" questions on this Mac — trace where a dir's value is preserved before advising (derived results captured elsewhere? source re-fetchable?), strip-extracts-keep-archives pattern with unzip -l proof per file, Trash-not-rm for approved deletions, and the full app-uninstall sequence (worked 2026-10-04 on Anaconda: dependency checks, shell init-block stripping with backups, fresh-shell verification). Also records 2026-10-04 machine-state facts: anaconda REMOVED, ~/tmp/aec-senate-* now zips-only.
source: auto-skill
extracted_at: '2026-10-04T00:35:00.000Z'
---

# Laptop disk-reclaim / app-removal playbook (this Mac)

User drops a home-dir path and asks "do I need this?" — the answer is
found, not guessed. Worked 2026-10-04: pruned 6.2 GB → 578 MB of AEC
Senate caches, then fully removed Anaconda (5.4 GB) in the same session.

## Step 0: before advising, find where the dir's VALUE survives

- Derived results — check the skills (`aec-senate-atl-flows` held every
  verified number) and `~/Downloads/<project>/` deliverables (REPORT.md,
  analysis scripts).
- Source re-fetchability — public downloads with documented URL
  patterns (the AEC `results.aec.gov.au/<EVENT>/...` set) can go; local
  caches are almost always regenerable. Package caches (`~/opt/
  anaconda3/pkgs`, npm caches) take nothing with them when pruned —
  envs hard-link OUT of them; the tidy tool is `conda clean --packages
  --tarballs`, never manual rm of a live cache.
- Apple support-folder DBs (`~/Music/Audio Music Apps/Databases/…index.db`
  = Logic Pro's Core Data content index, 112k items/95 packages) are
  app-rebuilt caches — advise "leave alone", not delete.

## Strip-extracts-keep-archives (when user picks the middle option)

For a download dir containing both `foo.zip` and its extracted `foo.csv`:

1. DRY-RUN list every candidate with a verdict, proving each extract is
   inside a kept archive before deleting it:
   `unzip -l "${c%.csv}.zip" | grep -q "$(basename "$c")"`.
   Files with no archive proof get verdict SKIP — keep them (they're
   usually small freestanding downloads: reconciliation targets,
   `SenateCandidatesDownload-*`, config).
2. Keep all archives + the small proof-less files; delete only proven
   extracts; `du -sh` before and after; show the dry-run table first.

## Approved deletions: Trash, not rm

When the user approves deletion of something big/irreproducible, `mv`
into `~/.Trash` (collision-suffix if the name's taken) rather than
`rm -rf` — instant on same volume, recoverable until they empty Trash:

```
trash() { p="$1"; base=$(basename "$p"); dest="$HOME/.Trash/$base"; i=1;
  while [ -e "$dest" ]; do dest="$HOME/.Trash/$base-$i"; i=$((i+1)); done
  mv "$p" "$dest" && echo "trashed: $p -> $dest"; }
```

## App-uninstall sequence (worked example: Anaconda, 2026-10-04)

1. **Dependency checks first** (all read-only):
   - `ls <envs>/` — empty means the user never made one (stock base only)
   - `which -a python3` etc. — does PATH resolve into the install?
     (Here: python.org 3.12 + Homebrew, nothing in anaconda.)
   - `grep -rli anaconda ~/Library/LaunchAgents` — scheduled-job refs
   - `find <install> -maxdepth 1 -newermt "90 days ago"` — recent use
2. **Map live tendrils**: shell init blocks (`# >>> conda initialize >>>`
   …`# <<< conda initialize <<<` in `~/.zshrc` `~/.bash_profile`), the
   `/Applications/*.app` bundle, dotfile leftovers (`~/.condarc`,
   `~/.conda`, `~/.continuum`, `~/.anaconda`).
3. **Trash everything** (install, app, dotfiles). Safe to do before
   unhooking the shell — orphaned conda blocks degrade to a harmless
   dead PATH entry, no errors.
4. **Strip the init blocks**: back up first
   (`cp ~/.zshrc ~/.zshrc.pre-<action>-strip`), then
   `sed -i '' '/>>> conda initialize >>>/,/<<< conda initialize <<</d'`
   both files, then tidy the double-blank the block leaves
   (awk squeeze) and a possible leading blank (`sed -i '' '1{/^$/d;}'`).
   Show `cat` of both after; grep for residual refs.
5. **Verify with fresh shells**: `zsh -i -c 'which conda'` → not found,
   `bash -l -c '…'` clean. A fresh shell is the only real proof.

## BOGAN boundary on $HOME edits

The edit tool REFUSES writes outside the workspace
("Refusing out-of-workspace write in BOGAN mode") — hit on `~/.zshrc`.
Do not retry variants. The sanctioned route: ask the user to approve
the shell-command form (they did: "Strip via shell"), then do it via
run_shell_command with backups. `write_file` to /tmp is refused too.

## Machine-state facts (as of 2026-10-04)

- **Anaconda is GONE from this Mac** (`~/opt/anaconda3` 5.4 GB → Trash;
  init blocks stripped; backups at `~/.zshrc.pre-conda-strip` and
  `~/.bash_profile.pre-conda-strip`). `~/opt` now holds only a
  .DS_Store. Any future "install conda/python tooling" suggestion must
  reckon with Homebrew + python.org 3.12 being the user's stack.
- **`~/tmp/aec-senate-{20499,24310,27966,31496}` are zips-only** (+
  few-KB reconciliation CSVs). The user-level `aec-senate-atl-flows`
  skill's "raw `~/tmp/aec-senate-*/`" references predate the prune —
  to re-run `~/Downloads/senate flows/analyse_atl_flows.py`, `unzip`
  the formal-preferences zips first. (User-level skill is outside the
  workspace, so this note lives here.)
- Pre-prune sizes preserved in `/private/tmp/aec-before.txt`.
