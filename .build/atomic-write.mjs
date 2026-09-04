/* atomic-write.mjs – last-writer-wins file writes used by every polls.json
   writer and by the build's output step. A plain writeFileSync truncates the
   target first; a killed process mid-write (OOM, Ctrl-C, two CI jobs racing
   the same checkout) leaves a half-written canonical file that the NEXT job
   then happily builds on. Write to a sibling temp name and rename over the
   target instead: the rename is atomic on POSIX, so readers only ever see
   the old file or the new file, never a torn one.
   Temp file is deliberately unhashed – a crashed run just overwrites it. */
import { renameSync, writeFileSync } from "node:fs";

export function writeAtomic(file, data) {
  const tmp = file + ".tmp";
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

export function writeJsonAtomic(file, obj) {
  writeAtomic(file, JSON.stringify(obj, null, 2) + "\n");
}
